import base64
import json
from typing import Any, Dict, List

from playwright.async_api import async_playwright
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("playwright", dependencies=["playwright"])

@mcp.tool()
async def playwright_smoke_test(url: str, wait_for_selector: str = "", expect_text: str = "", viewport_width: int = 1440, viewport_height: int = 900, timeout_ms: int = 30000, screenshot: bool = True) -> str:
    """Realiza un smoke test de una página web usando Playwright."""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={"width": viewport_width, "height": viewport_height})
            errors: List[str] = []
            try:
                response = await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
                if not response:
                    errors.append("No response returned")
                elif response.status >= 400:
                    errors.append(f"HTTP status {response.status}")
                if wait_for_selector:
                    await page.wait_for_selector(wait_for_selector, timeout=timeout_ms)
                text = await page.locator("body").inner_text(timeout=timeout_ms)
                if expect_text and expect_text not in text:
                    errors.append(f"Expected text not found: {expect_text}")
                screenshot_b64 = None
                if screenshot:
                    shot = await page.screenshot(full_page=True)
                    screenshot_b64 = base64.b64encode(shot).decode("ascii")
                title = await page.title()
                return json.dumps({
                    "ok": not errors,
                    "url": url,
                    "title": title,
                    "errors": errors,
                    "screenshot_base64": screenshot_b64,
                }, ensure_ascii=False)
            finally:
                await browser.close()
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
async def playwright_multi_smoke_test(urls_json: str, timeout_ms: int = 30000) -> str:
    """Realiza un smoke test rápido sobre múltiples URLs. urls_json es un JSON array de strings."""
    try:
        urls = json.loads(urls_json)
        results = []
        for url in urls:
            try:
                # We can reuse the inner logic, but to keep it simple we call the tool logic directly
                # However, calling async tools from within async tools requires await.
                async with async_playwright() as p:
                    browser = await p.chromium.launch()
                    page = await browser.new_page()
                    errors = []
                    try:
                        resp = await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
                        if not resp:
                            errors.append("No response")
                        elif resp.status >= 400:
                            errors.append(f"HTTP status {resp.status}")
                    except Exception as e:
                        errors.append(str(e))
                    finally:
                        await browser.close()
                results.append({"ok": not errors, "url": url, "errors": errors})
            except Exception as e:
                results.append({"ok": False, "url": url, "errors": [str(e)]})
        return json.dumps({"ok": all(item.get("ok") for item in results), "results": results}, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)})

app = mcp.sse_app()

if __name__ == '__main__':
    mcp.run()

