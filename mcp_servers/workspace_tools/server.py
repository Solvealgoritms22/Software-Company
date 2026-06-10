import os
import subprocess
import shlex
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx
from bs4 import BeautifulSoup
from mcp.server.fastmcp import FastMCP
import base64
import json

WORKSPACE_ROOT = Path(os.getenv("WORKSPACE_ROOT", "C:\\ProgramData\\Software-Company\\workspace" if os.name == "nt" else "/workspace")).resolve()
DEFAULT_ALLOWED_COMMANDS = {
    "node", "npm", "npx", "pnpm", "yarn",
    "python", "python3", "pip", "pytest",
    "git", "uvicorn", "playwright", "vercel", "railway",
}

mcp = FastMCP("workspace_tools", dependencies=["httpx", "beautifulsoup4"])

def safe_path(relative_path: str) -> Path:
    rel = relative_path.strip("/")
    path = (WORKSPACE_ROOT / rel).resolve()
    if WORKSPACE_ROOT not in path.parents and path != WORKSPACE_ROOT:
        raise ValueError("Path must stay inside WORKSPACE_ROOT")
    return path

def allowed_command_names() -> set[str]:
    raw = os.getenv("WORKSPACE_ALLOWED_COMMANDS", "")
    if not raw.strip():
        return DEFAULT_ALLOWED_COMMANDS
    return {item.strip().lower() for item in raw.split(",") if item.strip()}

def validate_command(command: str) -> List[str]:
    if os.getenv("WORKSPACE_ALLOW_UNSAFE_COMMANDS", "false").lower() == "true":
        return shlex.split(command, posix=os.name != "nt")

    forbidden_fragments = [
        "rm -rf", "mkfs", "dd ", "format ", "shutdown", "reboot", ":(){",
        "powershell", "cmd.exe", "cmd /c", "del ", "erase ", "reg ",
    ]
    shell_operators = ["&&", "||", ";", "|", ">", "<", "`", "$("]
    cmd_lower = command.lower()
    if any(fragment in cmd_lower for fragment in forbidden_fragments):
        raise ValueError("Command not allowed for security reasons.")
    if any(operator in command for operator in shell_operators):
        raise ValueError("Shell control operators are disabled for workspace commands.")

    parts = shlex.split(command, posix=os.name != "nt")
    if not parts:
        raise ValueError("Command is empty.")
    executable = Path(parts[0]).name.lower()
    if executable.endswith(".exe"):
        executable = executable[:-4]
    if executable not in allowed_command_names():
        raise ValueError(f"Command '{parts[0]}' is not in WORKSPACE_ALLOWED_COMMANDS.")
    return parts

@mcp.tool()
def execute_command(command: str, cwd: str = ".") -> str:
    """Ejecuta un comando de consola (cmd/bash) en el espacio de trabajo. Util para crear directorios, instalar dependencias, etc."""
    try:
        target_cwd = safe_path(cwd)
        if not target_cwd.exists():
            target_cwd.mkdir(parents=True, exist_ok=True)
            
        command_parts = validate_command(command)
                
        safe_env = os.environ.copy()
        for key in list(safe_env.keys()):
            key_upper = key.upper()
            if "KEY" in key_upper or "SECRET" in key_upper or "TOKEN" in key_upper or "PASSWORD" in key_upper:
                del safe_env[key]
        
        completed = subprocess.run(
            command_parts,
            cwd=target_cwd,
            shell=False,
            env=safe_env,
            capture_output=True,
            text=True,
            timeout=120
        )
        max_output_chars = int(os.getenv("WORKSPACE_MAX_COMMAND_OUTPUT_CHARS", "6000"))
        
        return json.dumps({
            "command": command,
            "cwd": str(target_cwd.relative_to(WORKSPACE_ROOT)),
            "returncode": completed.returncode,
            "stdout": completed.stdout[-max_output_chars:],
            "stderr": completed.stderr[-max_output_chars:]
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
def write_file(path: str, content: str, overwrite: bool = True) -> str:
    """Escribe o edita el contenido de un archivo en el espacio de trabajo."""
    try:
        file_path = safe_path(path)
        if file_path.exists() and not overwrite:
            return json.dumps({"error": f"File already exists: {path}"})
        
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
        return json.dumps({
            "status": "success",
            "path": str(file_path.relative_to(WORKSPACE_ROOT)),
            "size_bytes": file_path.stat().st_size
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
def read_file(path: str) -> str:
    """Lee el contenido de un archivo en el espacio de trabajo."""
    try:
        file_path = safe_path(path)
        if not file_path.exists():
            return json.dumps({"error": f"File not found: {path}"})
        if not file_path.is_file():
            return json.dumps({"error": f"Path is a directory, not a file: {path}"})
        
        return file_path.read_text(encoding="utf-8")
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
def create_directory(path: str) -> str:
    """Crea un directorio en el espacio de trabajo."""
    try:
        dir_path = safe_path(path)
        dir_path.mkdir(parents=True, exist_ok=True)
        return json.dumps({
            "status": "success",
            "path": str(dir_path.relative_to(WORKSPACE_ROOT))
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
async def web_search(query: str) -> str:
    """Busca en la web información actualizada en tiempo real."""
    url = f"https://html.duckduckgo.com/html/?q={query}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
            response = await client.get(url)
            if not response.is_success:
                return json.dumps({"error": f"DuckDuckGo returned code {response.status_code}"})
            
        soup = BeautifulSoup(response.text, "html.parser")
        results = []
        for a in soup.find_all("a", class_="result__snippet"):
            parent = a.parent
            title_node = parent.find("a", class_="result__url")
            if title_node:
                title = title_node.text.strip()
                link = title_node.get("href", "")
                snippet = a.text.strip()
                results.append({"title": title, "link": link, "snippet": snippet})
                if len(results) >= 8:
                    break
        
        if not results:
            for result in soup.find_all("div", class_="result"):
                title_node = result.find("a", class_="result__a")
                snippet_node = result.find("a", class_="result__snippet")
                if title_node:
                    title = title_node.text.strip()
                    link = title_node.get("href", "")
                    snippet = snippet_node.text.strip() if snippet_node else ""
                    results.append({"title": title, "link": link, "snippet": snippet})
                    if len(results) >= 8:
                        break
                        
        return json.dumps({"query": query, "results": results}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({
            "query": query,
            "error": str(exc),
            "results": [{"title": f"Búsqueda simulada: {query}", "link": "https://duckduckgo.com", "snippet": f"Resultado simulado por fallo de red. Buscando '{query}'."}]
        }, ensure_ascii=False)

@mcp.tool()
async def get_weather(city: str) -> str:
    """Obtiene las condiciones del clima actual para una ciudad."""
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        geocode_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=es&format=json"
        async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
            geo_response = await client.get(geocode_url)
            if not geo_response.is_success:
                return json.dumps({"error": "Geocoding API failed"})
            
            geo_data = geo_response.json()
            if not geo_data.get("results"):
                fallbacks = {
                    "bogota": (4.6097, -74.0817, "Colombia"),
                    "madrid": (40.4168, -3.7038, "España"),
                    "new york": (40.7128, -74.0060, "Estados Unidos"),
                    "londres": (51.5074, -0.1278, "Reino Unido"),
                    "london": (51.5074, -0.1278, "Reino Unido"),
                    "santiago": (-33.4489, -70.6693, "Chile"),
                    "mexico": (19.4326, -99.1332, "México"),
                    "buenos aires": (-34.6037, -58.3816, "Argentina")
                }
                c_clean = city.lower().strip()
                if c_clean in fallbacks:
                    lat, lon, country = fallbacks[c_clean]
                    name = city.capitalize()
                else:
                    return json.dumps({"error": f"City not found: {city}"})
            else:
                result = geo_data["results"][0]
                lat, lon, name, country = result["latitude"], result["longitude"], result["name"], result.get("country", "")
                
        weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,weather_code"
        async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
            weather_response = await client.get(weather_url)
            if not weather_response.is_success:
                return json.dumps({"error": "Weather forecast API failed"})
            data = weather_response.json().get("current", {})
            
        weather_descriptions = {
            0: "Cielo despejado", 1: "Principalmente despejado", 2: "Parcialmente nublado", 3: "Nublado",
            45: "Niebla", 48: "Niebla de escarcha", 51: "Llovizna ligera", 53: "Llovizna moderada", 55: "Llovizna densa",
            61: "Lluvia débil", 63: "Lluvia moderada", 65: "Lluvia fuerte", 71: "Nevada ligera", 73: "Nevada moderada", 75: "Nevada fuerte",
            80: "Lluvia con chubascos débil", 81: "Lluvia con chubascos moderada", 82: "Lluvia con chubascos violenta",
            95: "Tormenta débil o moderada", 96: "Tormenta con granizo débil", 99: "Tormenta con granizo fuerte"
        }
        code = data.get("weather_code", 0)
        desc = weather_descriptions.get(code, "Condiciones variables")
        
        return json.dumps({
            "city": name, "country": country, "latitude": lat, "longitude": lon,
            "temperature_c": data.get("temperature_2m"), "wind_speed_kmh": data.get("wind_speed_10m"),
            "humidity_percent": data.get("relative_humidity_2m"), "description": desc
        }, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"city": city, "country": "Desconocido", "temperature_c": 19.5, "wind_speed_kmh": 12.0, "humidity_percent": 65, "description": "Cielo parcialmente nublado (Simulado)", "note": f"Fallo al contactar el API de clima: {str(exc)}"}, ensure_ascii=False)

@mcp.tool()
async def convert_currency(amount: float, from_currency: str, to_currency: str) -> str:
    """Convierte un monto de una moneda a otra usando tipos de cambio actuales."""
    from_currency = from_currency.upper().strip()
    to_currency = to_currency.upper().strip()
    
    try:
        url = f"https://open.er-api.com/v6/latest/{from_currency}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            if not response.is_success:
                return json.dumps({"error": "Exchange rate API failed"})
            
            data = response.json()
            rates = data.get("rates", {})
            
        if to_currency not in rates:
            return json.dumps({"error": f"Target currency code not found: {to_currency}"})
            
        rate = rates[to_currency]
        return json.dumps({
            "from_currency": from_currency, "to_currency": to_currency,
            "original_amount": amount, "exchange_rate": rate, "converted_amount": round(amount * rate, 2),
            "updated_at_utc": data.get("time_last_update_utc")
        }, ensure_ascii=False)
    except Exception as exc:
        fallbacks = {
            "USD": {"EUR": 0.92, "COP": 4000.0, "MXN": 17.5, "USD": 1.0},
            "EUR": {"USD": 1.09, "COP": 4350.0, "MXN": 19.0, "EUR": 1.0},
            "COP": {"USD": 0.00025, "EUR": 0.00023, "COP": 1.0}
        }
        rate = fallbacks.get(from_currency, {}).get(to_currency, 1.0)
        return json.dumps({
            "from_currency": from_currency, "to_currency": to_currency,
            "original_amount": amount, "exchange_rate": rate, "converted_amount": round(amount * rate, 2),
            "note": f"Fallo ({str(exc)}). Usando tasa simulada."
        }, ensure_ascii=False)

@mcp.tool()
async def fetch_url(url: str) -> str:
    """Descarga y extrae el texto principal de una página web o URL."""
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        async with httpx.AsyncClient(headers=headers, timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            for script in soup(["script", "style"]):
                script.extract()
            return json.dumps({"url": url, "text": soup.get_text(separator=' ', strip=True)[:20000]}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
async def download_resource(url: str, path: str) -> str:
    """Descarga un archivo binario o recurso web y lo guarda en el espacio de trabajo."""
    try:
        out_path = safe_path(path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        headers = {"User-Agent": "Mozilla/5.0"}
        async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            out_path.write_bytes(response.content)
            return json.dumps({"status": "success", "path": str(out_path.relative_to(WORKSPACE_ROOT)), "size_bytes": len(response.content)})
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
async def generate_image(prompt: str, path: str) -> str:
    """Genera una imagen usando IA a partir de un texto y la guarda en disco."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return json.dumps({"error": "GEMINI_API_KEY is not configured"})
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={api_key}"
    payload = {"instances": [{"prompt": prompt}], "parameters": {"sampleCount": 1}}
    headers = {"Content-Type": "application/json"}
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if not response.is_success:
                return json.dumps({"error": f"Gemini API failed: {response.text}"})
            
            predictions = response.json().get("predictions", [])
            if not predictions:
                return json.dumps({"error": "No predictions returned from Gemini"})
                
            img_b64 = predictions[0].get("bytesBase64Encoded")
            if not img_b64:
                return json.dumps({"error": "No base64 image data found"})
                
            img_data = base64.b64decode(img_b64)
            out_path = safe_path(path)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(img_data)
            return json.dumps({"status": "success", "path": str(out_path.relative_to(WORKSPACE_ROOT)), "size_bytes": len(img_data)})
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
async def edit_image(image_path: str, prompt: str, output_path: str) -> str:
    """Edita una imagen existente usando IA."""
    return json.dumps({"status": "warning", "message": "La API de edición de imágenes requiere máscaras complejas. Usa generate_image."})

@mcp.tool()
async def request_founder_intervention(reason: str) -> str:
    """Interrumpe el flujo actual de la IA y solicita intervención humana o del fundador porque has encontrado un bloqueo."""
    return json.dumps({"status": "intervention_requested", "reason": reason})


@mcp.tool()
def replace_file_content(path: str, target_content: str, replacement_content: str) -> str:
    """Edita un archivo existente reemplazando un bloque contiguo de texto."""
    try:
        file_path = safe_path(path)
        if not file_path.exists():
            return json.dumps({"error": f"File not found: {path}"})
        
        content = file_path.read_text(encoding="utf-8")
        if target_content not in content:
            return json.dumps({"error": f"Target content not found in file."})
            
        new_content = content.replace(target_content, replacement_content, 1)
        file_path.write_text(new_content, encoding="utf-8")
        
        return json.dumps({"status": "success", "path": str(file_path.relative_to(WORKSPACE_ROOT))})
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
def multi_replace_file_content(path: str, replacements: list) -> str:
    """Realiza múltiples reemplazos en un mismo archivo."""
    try:
        file_path = safe_path(path)
        if not file_path.exists():
            return json.dumps({"error": f"File not found: {path}"})
            
        content = file_path.read_text(encoding="utf-8")
        for r in replacements:
            tgt = r.get("target_content", "")
            rep = r.get("replacement_content", "")
            if tgt in content:
                content = content.replace(tgt, rep, 1)
            else:
                return json.dumps({"error": f"Target content not found: {tgt[:30]}..."})
                
        file_path.write_text(content, encoding="utf-8")
        return json.dumps({"status": "success", "path": str(file_path.relative_to(WORKSPACE_ROOT))})
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
def grep_search(query: str, search_path: str, is_regex: bool = False) -> str:
    """Busca un patrón de texto dentro de archivos o directorios."""
    import re
    try:
        target = safe_path(search_path)
        if not target.exists():
            return json.dumps({"error": f"Path not found: {search_path}"})
            
        results = []
        pattern = re.compile(query) if is_regex else re.compile(re.escape(query))
        
        def search_file(f_path):
            try:
                text = f_path.read_text(encoding="utf-8", errors="ignore")
                for i, line in enumerate(text.splitlines(), 1):
                    if pattern.search(line):
                        results.append(f"{f_path.relative_to(WORKSPACE_ROOT)}:{i}:{line.strip()[:200]}")
                        if len(results) >= 50:
                            break
            except Exception:
                pass
                
        if target.is_file():
            search_file(target)
        else:
            for p in target.rglob("*"):
                if len(results) >= 50:
                    break
                if p.is_file() and not "/.git/" in p.as_posix() and not "/node_modules/" in p.as_posix():
                    search_file(p)
                    
        return json.dumps({"status": "success", "matches": results})
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
def list_dir(directory_path: str) -> str:
    """Lista el contenido de un directorio."""
    try:
        target = safe_path(directory_path)
        if not target.exists() or not target.is_dir():
            return json.dumps({"error": f"Directory not found: {directory_path}"})
            
        items = []
        for p in target.iterdir():
            items.append({
                "name": p.name,
                "is_dir": p.is_dir(),
                "size": p.stat().st_size if p.is_file() else 0
            })
            
        return json.dumps({"status": "success", "items": items})
    except Exception as e:
        return json.dumps({"error": str(e)})

app = mcp.sse_app()

if __name__ == '__main__':
    mcp.run()

