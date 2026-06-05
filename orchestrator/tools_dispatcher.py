import os
import json
import httpx
from typing import Dict, Any, Optional

from mcp_pool import call_stdio_tool
from tool_policy import evaluate_tool_policy
from tool_idempotency import complete_tool_call, fail_tool_call, reserve_tool_call

WORKSPACE_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "execute_command",
            "description": "Ejecuta un comando de consola (cmd/bash) en el espacio de trabajo. Util para crear directorios, instalar dependencias, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "El comando de consola a ejecutar, ej: 'npm install'"},
                    "cwd": {"type": "string", "description": "Directorio relativo donde se ejecuta"}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Escribe o edita el contenido de un archivo en el espacio de trabajo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Ruta relativa del archivo"},
                    "content": {"type": "string", "description": "Contenido completo del archivo"},
                    "overwrite": {"type": "boolean", "description": "Sobrescribir si el archivo ya existe"}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Lee el contenido de un archivo en el espacio de trabajo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Ruta relativa del archivo"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_url",
            "description": "Descarga y extrae el texto principal de una página web o URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL de la página a extraer"}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "download_resource",
            "description": "Descarga un archivo binario o recurso web y lo guarda en el espacio de trabajo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL del recurso a descargar"},
                    "path": {"type": "string", "description": "Ruta relativa en el espacio de trabajo donde se guardará"}
                },
                "required": ["url", "path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_image",
            "description": "Genera una imagen usando IA (Gemini/DALL-E) a partir de un texto y la guarda en disco.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Descripción detallada de la imagen a generar"},
                    "path": {"type": "string", "description": "Ruta relativa en el espacio de trabajo donde se guardará (ej: 'assets/logo.png')"}
                },
                "required": ["prompt", "path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit_image",
            "description": "Edita una imagen existente usando IA.",
            "parameters": {
                "type": "object",
                "properties": {
                    "image_path": {"type": "string", "description": "Ruta de la imagen existente"},
                    "prompt": {"type": "string", "description": "Instrucciones de cómo editarla"},
                    "output_path": {"type": "string", "description": "Ruta para guardar el resultado"}
                },
                "required": ["image_path", "prompt", "output_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Busca en la web información actualizada en tiempo real.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "La consulta de búsqueda"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Obtiene las condiciones del clima actual para una ciudad.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "Nombre de la ciudad, ej: 'Bogota'"}
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "convert_currency",
            "description": "Convierte un monto de una moneda a otra usando tipos de cambio actuales.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "Monto a convertir"},
                    "from_currency": {"type": "string", "description": "Código de moneda origen (3 letras), ej: 'USD'"},
                    "to_currency": {"type": "string", "description": "Código de moneda destino (3 letras), ej: 'COP'"}
                },
                "required": ["amount", "from_currency", "to_currency"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "ask_agent",
            "description": "Delega una pregunta o tarea específica a otro agente (ej: 'ui_ux_designer', 'software_architect') y espera su respuesta.",
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_name": {"type": "string", "description": "Nombre del agente al cual preguntar (ej: 'scrum_master')"},
                    "query": {"type": "string", "description": "La consulta o tarea detallada"}
                },
                "required": ["agent_name", "query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "request_founder_intervention",
            "description": "Interrumpe el flujo actual de la IA y solicita intervención humana o del fundador porque has encontrado un error fatal o bloqueo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Razón detallada de por qué necesitas intervención humana"}
                },
                "required": ["reason"]
            }
        }
    }
]

GITHUB_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "github_create_repo",
            "description": "Crea un nuevo repositorio en GitHub para el proyecto.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nombre del repositorio"},
                    "description": {"type": "string", "description": "Descripción opcional del repositorio"},
                    "private": {"type": "boolean", "description": "Si el repositorio es privado (por defecto falso)"}
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "github_create_branch",
            "description": "Crea una nueva rama de git a partir de una rama base.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo_full_name": {"type": "string", "description": "Nombre completo del repositorio (usuario/repo)"},
                    "new_branch": {"type": "string", "description": "Nombre de la nueva rama"},
                    "base_branch": {"type": "string", "description": "Rama base, ej: 'main'"}
                },
                "required": ["repo_full_name", "new_branch"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "github_commit_files",
            "description": "Crea commits con múltiples archivos a la vez en una rama específica de GitHub.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo_full_name": {"type": "string", "description": "Nombre completo del repositorio"},
                    "branch": {"type": "string", "description": "Rama donde se hará el commit"},
                    "message": {"type": "string", "description": "Mensaje del commit"},
                    "file_contents": {
                        "type": "object",
                        "description": "Diccionario mapeando rutas de archivos a su respectivo contenido de texto, ej: {'src/index.js': 'console.log(...)'}"
                    }
                },
                "required": ["repo_full_name", "branch", "message", "file_contents"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "github_create_pull_request",
            "description": "Crea un pull request de una rama origen a una rama destino.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo_full_name": {"type": "string", "description": "Nombre completo del repositorio"},
                    "head_branch": {"type": "string", "description": "Rama de origen (característica)"},
                    "base_branch": {"type": "string", "description": "Rama destino, ej: 'main'"},
                    "title": {"type": "string", "description": "Título del pull request"},
                    "body": {"type": "string", "description": "Descripción del pull request"}
                },
                "required": ["repo_full_name", "head_branch", "title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "github_read_file",
            "description": "Lee el contenido de un archivo desde un repositorio de GitHub.",
            "parameters": {
                "type": "object",
                "properties": {
                    "repo_full_name": {"type": "string", "description": "Nombre completo del repositorio"},
                    "path": {"type": "string", "description": "Ruta del archivo en el repositorio"},
                    "ref": {"type": "string", "description": "Rama o commit de referencia (por defecto 'main')"}
                },
                "required": ["repo_full_name", "path"]
            }
        }
    }
]

JIRA_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "jira_create_issue",
            "description": "Crea un nuevo ticket/incidencia en Jira.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string", "description": "Resumen/título del ticket"},
                    "description": {"type": "string", "description": "Descripción detallada del ticket"},
                    "issue_type": {"type": "string", "description": "Tipo de ticket, ej: 'Task', 'Story', 'Bug' (por defecto 'Task')"},
                    "project_key": {"type": "string", "description": "Código del proyecto de Jira (por defecto se lee la config global)"},
                    "labels": {"type": "array", "items": {"type": "string"}, "description": "Etiquetas del ticket"}
                },
                "required": ["summary"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "jira_add_comment",
            "description": "Añade un comentario a un ticket existente de Jira.",
            "parameters": {
                "type": "object",
                "properties": {
                    "issue_key": {"type": "string", "description": "Código del ticket, ej: 'PROJ-123'"},
                    "body": {"type": "string", "description": "Contenido del comentario"}
                },
                "required": ["issue_key", "body"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "jira_transition_issue",
            "description": "Transiciona el estado de un ticket en Jira.",
            "parameters": {
                "type": "object",
                "properties": {
                    "issue_key": {"type": "string", "description": "Código del ticket"},
                    "transition_id": {"type": "string", "description": "ID de la transición a ejecutar"}
                },
                "required": ["issue_key", "transition_id"]
            }
        }
    }
]

CONFLUENCE_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "confluence_create_page",
            "description": "Crea y publica una nueva página en Confluence con contenido técnico o de negocio.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Título de la página"},
                    "markdown_body": {"type": "string", "description": "Cuerpo de la página en formato Markdown"},
                    "space_key": {"type": "string", "description": "Código del espacio de Confluence (por defecto lee la config global)"},
                    "parent_id": {"type": "string", "description": "ID de la página padre en Confluence si se quiere jerarquizar"}
                },
                "required": ["title", "markdown_body"]
            }
        }
    }
]

GOOGLE_DRIVE_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "google_drive_create_text_file",
            "description": "Guarda un archivo de texto o markdown en Google Drive.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nombre del archivo a crear"},
                    "content": {"type": "string", "description": "Contenido del archivo"},
                    "mime_type": {"type": "string", "description": "Tipo MIME del archivo, ej: 'text/markdown' o 'text/plain' (por defecto 'text/markdown')"},
                    "folder_id": {"type": "string", "description": "ID de la carpeta en Google Drive donde guardar el archivo"}
                },
                "required": ["name", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "google_drive_create_permission",
            "description": "Concede permisos de acceso a un archivo en Google Drive.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {"type": "string", "description": "ID del archivo en Google Drive"},
                    "role": {"type": "string", "description": "Rol a otorgar: 'owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader' (por defecto 'reader')"},
                    "type": {"type": "string", "description": "Tipo de destinatario: 'user', 'group', 'domain', 'anyone' (por defecto 'anyone')"},
                    "email_address": {"type": "string", "description": "Dirección de correo electrónico si tipo es user o group"}
                },
                "required": ["file_id"]
            }
        }
    }
]

DEPLOY_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "deploy_vercel",
            "description": "Despliega una aplicación frontend en Vercel.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_path": {"type": "string", "description": "Ruta relativa del proyecto dentro del workspace (por defecto '.')"},
                    "production": {"type": "boolean", "description": "Establecer en verdadero si es un despliegue de producción"},
                    "extra_args": {"type": "array", "items": {"type": "string"}, "description": "Argumentos extra opcionales para la CLI de Vercel"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "deploy_railway",
            "description": "Despliega un servicio backend en Railway.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_path": {"type": "string", "description": "Ruta relativa del proyecto dentro del workspace (por defecto '.')"},
                    "service": {"type": "string", "description": "Nombre del servicio de Railway a desplegar"},
                    "environment": {"type": "string", "description": "Nombre del entorno en Railway"},
                    "extra_args": {"type": "array", "items": {"type": "string"}, "description": "Argumentos extra opcionales para la CLI de Railway"}
                }
            }
        }
    }
]

PLAYWRIGHT_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "playwright_smoke_test",
            "description": "Realiza una prueba de humo y captura de pantalla de un sitio web usando Playwright.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL del sitio web a comprobar"},
                    "wait_for_selector": {"type": "string", "description": "Selector opcional a esperar en la página"},
                    "expect_text": {"type": "string", "description": "Texto opcional que se espera encontrar en la página"},
                    "viewport_width": {"type": "integer", "description": "Ancho del viewport (por defecto 1440)"},
                    "viewport_height": {"type": "integer", "description": "Alto del viewport (por defecto 900)"},
                    "timeout_ms": {"type": "integer", "description": "Tiempo de espera máximo en milisegundos (por defecto 30000)"},
                    "screenshot": {"type": "boolean", "description": "Si se debe tomar una captura de pantalla (por defecto verdadero)"}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "playwright_multi_smoke_test",
            "description": "Realiza pruebas de humo a múltiples URLs en paralelo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "urls": {"type": "array", "items": {"type": "string"}, "description": "Listado de URLs a validar"},
                    "timeout_ms": {"type": "integer", "description": "Tiempo máximo en milisegundos"}
                },
                "required": ["urls"]
            }
        }
    }
]

SECURITY_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "security_bandit_scan",
            "description": "Ejecuta un escaneo de seguridad estático en código de Python usando Bandit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_path": {"type": "string", "description": "Ruta relativa del directorio del código Python (por defecto '.')"},
                    "extra_args": {"type": "array", "items": {"type": "string"}, "description": "Argumentos extras opcionales para Bandit"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "security_npm_audit",
            "description": "Ejecuta una auditoría de dependencias Node.js usando npm audit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_path": {"type": "string", "description": "Ruta relativa del directorio con el package.json (por defecto '.')"},
                    "extra_args": {"type": "array", "items": {"type": "string"}, "description": "Argumentos extras opcionales para npm audit"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "security_zap_baseline",
            "description": "Ejecuta un análisis activo/pasivo rápido de OWASP ZAP contra una URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target_url": {"type": "string", "description": "URL objetivo a analizar"},
                    "zap_api_url": {"type": "string", "description": "URL de la API de ZAP (opcional)"}
                },
                "required": ["target_url"]
            }
        }
    }
]

class ToolDispatcher:
    
    @staticmethod
    async def dispatch(
        name: str,
        arguments: Dict[str, Any],
        agent_name: Optional[str] = None,
        project_id: Optional[str] = None,
        phase_id: Optional[str] = None,
    ) -> str:
        import json
        from config_manager import load_agents
        
        builtin_tools = {
            "execute_command", "write_file", "read_file", "fetch_url", "download_resource",
            "generate_image", "edit_image", "web_search", "get_weather", "convert_currency",
        }
        prefix_tools = {
            "github_": {"github_mcp", "github"},
            "jira_": {"jira_mcp", "jira"},
            "confluence_": {"confluence_mcp", "confluence"},
            "google_drive_": {"google_drive_mcp", "google_drive"},
            "deploy_": {"deploy_mcp", "deploy", "vercel_cli", "railway_cli"},
            "playwright_": {"playwright_mcp", "playwright", "playwright_cli"},
            "security_": {"security_mcp", "security"},
        }
        allowed = set()
        if agent_name:
            agent_cfg = load_agents().get("agents", {}).get(agent_name, {})
            agent_tools = set(agent_cfg.get("tools", []))
            allowed.update(tool for tool in builtin_tools if tool in agent_tools)
            for prefix, contract_tools in prefix_tools.items():
                if agent_tools.intersection(contract_tools):
                    allowed.add(prefix)
        else:
            allowed.update(builtin_tools)
            allowed.update(prefix_tools.keys())

        is_allowed = name in allowed or any(name.startswith(prefix) for prefix in allowed if prefix.endswith("_"))
        if not is_allowed:
            return json.dumps({"error": f"Tool '{name}' is not allowed for agent '{agent_name}'."})

        policy = evaluate_tool_policy(name, arguments, agent_name=agent_name, project_id=project_id, phase_id=phase_id)
        if not policy["allowed"]:
            approval = policy.get("approval") or {}
            return json.dumps({
                "error": "Tool approval required",
                "approval_required": True,
                "approval_id": approval.get("id"),
                "tool_name": name,
                "risk": policy.get("risk"),
                "category": policy.get("category"),
                "reason": policy.get("reason"),
                "status": approval.get("status", "pending"),
            }, ensure_ascii=False)

        idempotency = reserve_tool_call(
            name,
            arguments,
            agent_name=agent_name,
            project_id=project_id,
            phase_id=phase_id,
        )
        if idempotency.get("hit"):
            return str(idempotency.get("result") or "")
        if idempotency.get("blocked"):
            return json.dumps({
                "error": "Duplicate tool call already running",
                "idempotency_blocked": True,
                "idempotency_key": idempotency.get("idempotency_key"),
                "reason": idempotency.get("reason"),
            }, ensure_ascii=False)
        
        server_dir = "workspace_tools"
        if name.startswith("github_"): server_dir = "github"
        elif name.startswith("jira_"): server_dir = "jira"
        elif name.startswith("confluence_"): server_dir = "confluence"
        elif name.startswith("google_drive_"): server_dir = "google_drive"
        elif name.startswith("deploy_"): server_dir = "deploy"
        elif name.startswith("playwright_"): server_dir = "playwright"
        elif name.startswith("security_"): server_dir = "security"
        
        payload = dict(arguments)
        if agent_name and name in ["github_commit_files", "jira_create_issue", "jira_add_comment", "confluence_create_page"]:
            payload["agent_name"] = agent_name

        def result_has_error(result: str) -> bool:
            try:
                obj = json.loads(result)
                if isinstance(obj, dict):
                    return bool(obj.get("error") or obj.get("Error"))
            except Exception:
                pass
            return result.startswith("Error calling ") or result.startswith("Error:")

        try:
            result = await call_stdio_tool(server_dir, name, payload)
            if result_has_error(result):
                fail_tool_call(idempotency.get("id"), result, result)
            else:
                complete_tool_call(idempotency.get("id"), result)
            if policy.get("approval_bypassed"):
                try:
                    data = json.loads(result)
                    if isinstance(data, dict):
                        data.setdefault("policy", {})
                        data["policy"]["approval_bypassed"] = True
                        data["policy"]["category"] = policy.get("category")
                        data["policy"]["risk"] = policy.get("risk")
                        return json.dumps(data, ensure_ascii=False)
                except Exception:
                    pass
            return result
        except Exception as e:
            error = f"Error calling {name} via pooled MCP stdio: {str(e)}"
            fail_tool_call(idempotency.get("id"), error, error)
            return error
