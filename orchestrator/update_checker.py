import os
import requests

def check_for_update():
    url = os.getenv("UPDATE_MANIFEST_URL")
    if not url:
        return None
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, dict):
                return data
    except Exception as e:
        print(f"Error checking updates: {e}")
    return None
