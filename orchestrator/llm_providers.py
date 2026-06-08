import os
from typing import Dict, Optional


def provider_config(provider: str) -> Dict[str, Optional[str]]:
    normalized = provider.lower()
    if normalized == "deepseek":
        return {
            "api_key": os.getenv("DEEPSEEK_API_KEY"),
            "base_url": os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        }
    if normalized == "openai":
        return {
            "api_key": os.getenv("OPENAI_API_KEY"),
            "base_url": os.getenv("OPENAI_BASE_URL") or None,
        }
    if normalized == "azure":
        return {
            "api_key": os.getenv("AZURE_OPENAI_API_KEY"),
            "base_url": os.getenv("AZURE_OPENAI_ENDPOINT") or None,
        }
    if normalized == "ollama":
        return {
            "api_key": os.getenv("OLLAMA_API_KEY", "ollama-local-api-key"),
            "base_url": os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434/v1"),
        }
    if normalized == "lmstudio":
        return {
            "api_key": os.getenv("LMSTUDIO_API_KEY", "lmstudio-local-api-key"),
            "base_url": os.getenv("LMSTUDIO_BASE_URL", "http://host.docker.internal:1234/v1"),
        }
    if normalized == "vllm":
        return {
            "api_key": os.getenv("VLLM_API_KEY", "vllm-local-api-key"),
            "base_url": os.getenv("VLLM_BASE_URL", "http://host.docker.internal:8000/v1"),
        }
    return {"api_key": None, "base_url": None}
