import json
import os
import time
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI

from llm_prompts import build_system_prompt, build_user_prompt
from llm_providers import provider_config
from llm_tools import build_available_tools
from phase_contracts import (
    build_phase_output_schema,
    normalize_phase_output,
    phase_contracts_enabled,
    phase_schema_response_format_enabled,
)
from tools_dispatcher import ToolDispatcher
from token_budget import (
    assert_within_prompt_budget,
    compact_text,
    estimate_cost_usd,
    max_output_tokens,
    max_tool_output_chars,
    max_tool_turns,
    usage_dict,
)


async def generate_phase_artifact(
    phase_id: str,
    agent_id: str,
    agent: Dict[str, Any],
    project_name: str,
    client_goal: str,
    budget: Optional[str],
    existing_artifacts: List[Dict[str, Any]],
    memory_context: Optional[List[Dict[str, Any]]] = None,
    on_tool_call: Optional[Any] = None,
    on_trace: Optional[Any] = None,
    on_token: Optional[Any] = None,
    enabled_tools: Optional[List[str]] = None,
    disabled_tools: Optional[List[str]] = None,
    project_id: Optional[str] = None,
) -> Dict[str, Any]:
    provider = agent.get("provider") or os.getenv("DEFAULT_LLM_PROVIDER", "openai")
    model = agent.get("model") or os.getenv("DEFAULT_LLM_MODEL", "gpt-4.1-mini")
    fallback_model = agent.get("fallback_model")

    if provider.lower() == "azure" and not (os.getenv("AZURE_OPENAI_API_KEY") and os.getenv("AZURE_OPENAI_ENDPOINT")):
        if os.getenv("OPENAI_API_KEY"):
            provider = "openai"
            if model == "gpt-35-turbo":
                model = "gpt-3.5-turbo"
            elif model not in ["gpt-4o", "gpt-4", "gpt-4-turbo", "gpt-4.1-mini"]:
                model = os.getenv("DEFAULT_LLM_MODEL", "gpt-4.1-mini")
            if fallback_model == "gpt-35-turbo":
                fallback_model = "gpt-3.5-turbo"
            elif fallback_model not in ["gpt-4o", "gpt-4", "gpt-4-turbo"]:
                fallback_model = "gpt-4o"

    config = provider_config(provider)

    if not config["api_key"]:
        raise RuntimeError(
            f"{provider.upper()} API key is not configured. "
            "The orchestrator cannot generate real phase artifacts without a configured model provider."
        )

    if provider.lower() == "azure":
        from openai import AsyncAzureOpenAI
        client = AsyncAzureOpenAI(
            api_key=config["api_key"],
            azure_endpoint=config.get("base_url") or "",
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        )
    elif provider.lower() == "anthropic":
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=config["api_key"])
    elif provider.lower() == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=config["api_key"])
        client = None # Using genai natively
    else:
        client_kwargs: Dict[str, str] = {"api_key": config["api_key"]}
        if config.get("base_url"):
            client_kwargs["base_url"] = config["base_url"]
        client = AsyncOpenAI(**client_kwargs)

    messages = [
        {"role": "system", "content": build_system_prompt(agent_id, agent, project_name, enabled_tools, disabled_tools)},
        {
            "role": "user",
            "content": build_user_prompt(phase_id, project_name, client_goal, budget, existing_artifacts, memory_context),
        },
    ]
    phase_output_schema = build_phase_output_schema(agent_id, agent) if phase_contracts_enabled() else None
    use_schema_response_format = (
        bool(phase_output_schema)
        and phase_schema_response_format_enabled()
        and provider.lower() in {"openai", "azure"}
    )
    prompt_budget = assert_within_prompt_budget(messages, model)

    available_tools = build_available_tools(agent, enabled_tools)

    async def emit_trace(event_type: str, metadata: Dict[str, Any]) -> None:
        if on_trace:
            await on_trace(event_type, metadata)

    async def call_model(model_name: str, force_json: bool = False):
        started = time.perf_counter()
        trace_base = {
            "provider": provider,
            "model": model_name,
            "force_json": force_json,
            "message_count": len(messages),
            "tool_count": len(available_tools),
            "phase_contract": bool(phase_output_schema),
            "schema_response_format": bool(force_json and use_schema_response_format),
        }
        if provider.lower() == "anthropic":
            anthropic_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages if msg["role"] in ["user", "assistant"]]
            system_msg = next((msg["content"] for msg in messages if msg["role"] == "system"), "")
            
            try:
                response = await client.messages.create(
                    model=model_name,
                    system=system_msg,
                    messages=anthropic_messages,
                    max_tokens=max_output_tokens(),
                    temperature=0.2
                )
            except Exception as exc:
                await emit_trace("llm_call", {**trace_base, "status": "failed", "duration_ms": int((time.perf_counter() - started) * 1000), "error": str(exc)})
                raise
            class MockMessage:
                def __init__(self, content):
                    self.content = content
                    self.tool_calls = None
            class MockChoice:
                def __init__(self, message):
                    self.message = message
            class MockResponse:
                def __init__(self, choices):
                    self.choices = choices
                    self.usage = None
            await emit_trace("llm_call", {**trace_base, "status": "completed", "duration_ms": int((time.perf_counter() - started) * 1000), "usage": None})
            return MockResponse([MockChoice(MockMessage(response.content[0].text))])
            
        elif provider.lower() == "gemini":
            gemini_model = genai.GenerativeModel(model_name)
            sys_msg = next((msg["content"] for msg in messages if msg["role"] == "system"), "")
            prompt = sys_msg + "\n\n" + "\n".join([f"{m['role']}: {m['content']}" for m in messages if m["role"] != "system"])
            try:
                response = await gemini_model.generate_content_async(prompt)
            except Exception as exc:
                await emit_trace("llm_call", {**trace_base, "status": "failed", "duration_ms": int((time.perf_counter() - started) * 1000), "error": str(exc)})
                raise
            class MockMessage:
                def __init__(self, content):
                    self.content = content
                    self.tool_calls = None
            class MockChoice:
                def __init__(self, message):
                    self.message = message
            class MockResponse:
                def __init__(self, choices):
                    self.choices = choices
                    self.usage = None
            await emit_trace("llm_call", {**trace_base, "status": "completed", "duration_ms": int((time.perf_counter() - started) * 1000), "usage": None})
            return MockResponse([MockChoice(MockMessage(response.text))])

        kwargs = {}
        if available_tools and not force_json:
            kwargs["tools"] = available_tools
            kwargs["tool_choice"] = "auto"
        elif force_json:
            if use_schema_response_format:
                kwargs["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "phase_output_contract",
                        "strict": True,
                        "schema": phase_output_schema,
                    },
                }
            else:
                kwargs["response_format"] = {"type": "json_object"}
        if "o1" in model_name or "o3" in model_name:
            kwargs["max_completion_tokens"] = max_output_tokens()
        else:
            kwargs["max_tokens"] = max_output_tokens()
            
        reasoning_effort = agent.get("reasoning_effort", "medium")
        if reasoning_effort and reasoning_effort.lower() != "none":
            if "o1" in model_name or "o3" in model_name:
                kwargs["reasoning_effort"] = reasoning_effort.lower()
            
        import asyncio
        max_attempts = 6
        for attempt in range(max_attempts):
            try:
                if force_json and on_token:
                    kwargs["stream"] = True
                    stream = await client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        temperature=0.2 if ("o1" not in model_name and "o3" not in model_name) else 1,
                        **kwargs
                    )
                    full_content = ""
                    async for chunk in stream:
                        if chunk.choices and chunk.choices[0].delta.content:
                            token = chunk.choices[0].delta.content
                            full_content += token
                            await on_token(token)
                    class MockMessage:
                        def __init__(self, content): self.content = content
                        tool_calls = None
                    class MockChoice:
                        def __init__(self, message): self.message = message
                    class MockResponse:
                        def __init__(self, choices): self.choices = choices
                        usage = None
                    await emit_trace("llm_call", {
                        **trace_base,
                        "status": "completed",
                        "duration_ms": int((time.perf_counter() - started) * 1000),
                        "streamed": True,
                        "usage": None,
                    })
                    return MockResponse([MockChoice(MockMessage(full_content))])
                else:
                    response = await client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        temperature=0.2 if ("o1" not in model_name and "o3" not in model_name) else 1,
                        **kwargs
                    )
                    await emit_trace("llm_call", {
                        **trace_base,
                        "status": "completed",
                        "duration_ms": int((time.perf_counter() - started) * 1000),
                        "usage": usage_dict(response.usage),
                        "tool_calls": len(response.choices[0].message.tool_calls or []),
                    })
                    return response
            except Exception as e:
                err_str = str(e).lower()
                if (
                    force_json
                    and kwargs.get("response_format", {}).get("type") == "json_schema"
                    and any(term in err_str for term in ["response_format", "json_schema", "schema", "unsupported"])
                    and attempt < max_attempts - 1
                ):
                    kwargs["response_format"] = {"type": "json_object"}
                    await emit_trace("llm_call", {
                        **trace_base,
                        "status": "schema_format_fallback",
                        "duration_ms": int((time.perf_counter() - started) * 1000),
                        "error": str(e),
                    })
                    continue
                if "429" in err_str or "too many requests" in err_str or "503" in err_str or "rate limit" in err_str:
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(2 ** attempt + 2)
                        continue
                if "reasoning_effort" in kwargs:
                    del kwargs["reasoning_effort"]
                    if attempt < max_attempts - 1:
                        continue
                if attempt == max_attempts - 1:
                    await emit_trace("llm_call", {
                        **trace_base,
                        "status": "failed",
                        "duration_ms": int((time.perf_counter() - started) * 1000),
                        "attempt": attempt + 1,
                        "error": str(e),
                    })
                    raise e

    used_model = model
    try:
        # Loop for tool execution (ReAct)
        max_turns = max_tool_turns()
        turn = 0
        consecutive_errors = 0
        max_consecutive_errors = 3
        response = None
        while turn < max_turns:
            response = await call_model(used_model, force_json=False)
            message = response.choices[0].message
            
            # If the model does not request tool calls, we check if it is formatted correctly.
            if not message.tool_calls:
                break
                
            messages.append(message)
            
            # Execute tool calls
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                try:
                    tool_args = json.loads(tool_call.function.arguments)
                except Exception:
                    tool_args = {}
                    
                if on_tool_call:
                    arg_str = ", ".join(f"{k}={compact_text(v, 180)}" for k, v in tool_args.items())
                    await on_tool_call(f"🔧 Usando herramienta {tool_name}({arg_str})")
                    
                if tool_name == "request_founder_intervention":
                    reason = tool_args.get("reason", "Se solicitó intervención manual.")
                    await emit_trace("tool_call", {
                        "tool_name": tool_name,
                        "status": "intervention_requested",
                        "turn": turn,
                        "arguments": tool_args,
                        "reason": reason,
                    })
                    raise RuntimeError(f"Intervención solicitada por el agente: {reason}")

                tool_started = time.perf_counter()
                tool_error: Optional[str] = None
                if tool_name == "ask_agent":
                    target_agent_name = tool_args.get("agent_name", "")
                    query = tool_args.get("query", "")
                    try:
                        from config_manager import load_agents
                        all_agents = load_agents().get("agents", {})
                        if target_agent_name in all_agents:
                            target_cfg = all_agents[target_agent_name]
                            sub_sys_prompt = target_cfg.get("system_prompt", f"You are {target_agent_name}.")
                            sub_messages = [
                                {"role": "system", "content": f"{sub_sys_prompt}\n\nResponde directamente a la siguiente consulta de tu compañero de equipo. Tienes el contexto del proyecto: {project_name}"},
                                {"role": "user", "content": query}
                            ]
                            sub_res = await client.chat.completions.create(
                                model=target_cfg.get("model", model),
                                messages=sub_messages,
                                temperature=0.2
                            )
                            tool_result = sub_res.choices[0].message.content or "No response from agent."
                        else:
                            tool_result = f"Error: Agent '{target_agent_name}' not found in registry."
                    except Exception as e:
                        tool_result = f"Error asking agent: {e}"
                        tool_error = str(e)
                else:
                    try:
                        tool_result = await ToolDispatcher.dispatch(
                            tool_name,
                            tool_args,
                            agent_id,
                            project_id=project_id,
                            phase_id=phase_id,
                        )
                    except Exception as exc:
                        tool_error = str(exc)
                        tool_result = f"Error calling {tool_name}: {exc}"
                tool_result = compact_text(tool_result, max_tool_output_chars())
                
                # Check for errors in tool_result
                is_error = False
                try:
                    res_obj = json.loads(tool_result)
                    if res_obj.get("approval_required"):
                        await emit_trace("tool_call", {
                            "tool_name": tool_name,
                            "status": "approval_required",
                            "turn": turn,
                            "duration_ms": int((time.perf_counter() - tool_started) * 1000),
                            "arguments": tool_args,
                            "result_preview": compact_text(tool_result, 1200),
                            "approval_id": res_obj.get("approval_id"),
                            "risk": res_obj.get("risk"),
                            "category": res_obj.get("category"),
                            "reason": res_obj.get("reason"),
                        })
                        raise RuntimeError(
                            "TOOL_APPROVAL_REQUIRED: "
                            f"Aprobación requerida para herramienta {tool_name}. "
                            f"Approval ID: {res_obj.get('approval_id')}. Motivo: {res_obj.get('reason')}"
                        )
                    if "error" in res_obj or "Error" in res_obj:
                        is_error = True
                except RuntimeError:
                    raise
                except Exception:
                    if "Error calling" in tool_result or "Error:" in tool_result:
                        is_error = True
                if tool_error:
                    is_error = True

                await emit_trace("tool_call", {
                    "tool_name": tool_name,
                    "status": "failed" if is_error else "completed",
                    "turn": turn,
                    "duration_ms": int((time.perf_counter() - tool_started) * 1000),
                    "arguments": tool_args,
                    "result_preview": compact_text(tool_result, 1200),
                    "result_chars": len(tool_result),
                    "error": tool_error,
                })
                        
                if is_error:
                    consecutive_errors += 1
                    if consecutive_errors >= max_consecutive_errors:
                        raise RuntimeError(f"Límite de {max_consecutive_errors} errores consecutivos alcanzado en herramientas. Último error: {tool_result}")
                else:
                    consecutive_errors = 0
                
                if on_tool_call:
                    log_msg = f"✅ Herramienta {tool_name} ejecutada exitosamente." if not is_error else f"❌ Error en herramienta {tool_name}."
                    if tool_name == "execute_command":
                        try:
                            res_obj = json.loads(tool_result)
                            stdout_snippet = res_obj.get("stdout", "").strip()[:100]
                            log_msg += f" Código: {res_obj.get('returncode')}. Salida: {stdout_snippet}..."
                        except Exception:
                            pass
                    elif tool_name == "web_search":
                        try:
                            res_obj = json.loads(tool_result)
                            log_msg += f" Encontrados {len(res_obj.get('results', []))} resultados."
                        except Exception:
                            pass
                    await on_tool_call(log_msg)
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": tool_name,
                    "content": tool_result
                })
            
            turn += 1
            
        # One last call to ensure strict JSON formatting
        if turn > 0:
            messages.append({
                "role": "user",
                "content": "Por favor, consolida toda la información recopilada y entrega el JSON final esperado con las llaves summary, deliverables, risks, next_required_inputs y citations."
            })
        
        prompt_budget = assert_within_prompt_budget(messages, used_model)
        response = await call_model(used_model, force_json=True)
            
    except Exception:
        if fallback_model and fallback_model != model:
            used_model = fallback_model
            response = await call_model(used_model, force_json=True)
        else:
            raise

    content = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = {
            "summary": content,
            "deliverables": {},
            "risks": ["Model did not return valid JSON."],
            "next_required_inputs": [],
            "citations": [],
        }
    if phase_contracts_enabled():
        parsed, contract_validation = normalize_phase_output(parsed, agent_id, agent)
        parsed["contract_validation"] = contract_validation
    else:
        try:
            from models import PhaseOutput
            parsed_model = PhaseOutput.model_validate(parsed)
            parsed = parsed_model.model_dump()
        except Exception as e:
            print(f"Pydantic validation error: {e}, using parsed JSON fallback")
            
    parsed["provider"] = provider
    parsed["model"] = used_model
    usage = usage_dict(response.usage)
    parsed["usage"] = usage or None
    parsed["estimated_cost_usd"] = estimate_cost_usd(used_model, usage)
    parsed["prompt_budget"] = {
        **prompt_budget,
        "memory_chunks": len(memory_context or []),
        "memory_source": "artifact_memory" if memory_context is not None else "in_process_artifacts",
    }
    return parsed
