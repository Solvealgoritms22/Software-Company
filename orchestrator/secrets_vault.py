import base64
import os
import ctypes
from ctypes import wintypes
from typing import Any, Dict

class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_byte)),
    ]

def _dpapi_available() -> bool:
    return os.name == "nt"

def encrypt_secret(val: str) -> Dict[str, Any]:
    if not val:
        return {"backend": "plain", "value": ""}
        
    if _dpapi_available():
        try:
            crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            crypt32.CryptProtectData.argtypes = [
                ctypes.POINTER(_DataBlob),
                wintypes.LPCWSTR,
                ctypes.POINTER(_DataBlob),
                wintypes.LPVOID,
                wintypes.LPVOID,
                wintypes.DWORD,
                ctypes.POINTER(_DataBlob),
            ]
            crypt32.CryptProtectData.restype = wintypes.BOOL
            kernel32.LocalFree.argtypes = [wintypes.HLOCAL]
            kernel32.LocalFree.restype = wintypes.HLOCAL
            
            raw = val.encode("utf-8")
            raw_buffer = ctypes.create_string_buffer(raw)
            in_blob = _DataBlob(len(raw), ctypes.cast(raw_buffer, ctypes.POINTER(ctypes.c_byte)))
            out_blob = _DataBlob()
            
            if not crypt32.CryptProtectData(
                ctypes.byref(in_blob),
                None,
                None,
                None,
                None,
                0,
                ctypes.byref(out_blob),
            ):
                raise ctypes.WinError(ctypes.get_last_error())
            try:
                encrypted = ctypes.string_at(out_blob.pbData, out_blob.cbData)
                encoded = base64.b64encode(encrypted).decode("ascii")
                return {"backend": "dpapi", "value": encoded}
            finally:
                kernel32.LocalFree(out_blob.pbData)
        except Exception as e:
            print(f"Error executing DPAPI protect: {e}")
            
    # Fallback to plain/base64 encoded (same as keyboardia)
    encoded = base64.b64encode(val.encode("utf-8")).decode("ascii")
    return {"backend": "plain", "value": encoded}

def decrypt_secret(val: Any) -> str:
    if not val:
        return ""
    if isinstance(val, str):
        # Already plaintext or unmigrated legacy key
        return val
        
    if not isinstance(val, dict):
        return str(val)
        
    backend = val.get("backend")
    encrypted_val = val.get("value", "")
    
    if not encrypted_val:
        return ""
        
    if backend == "dpapi":
        if not _dpapi_available():
            # If DPAPI is not available, try to treat as plain or print warning
            print("Warning: DPAPI not available to decrypt secret")
            return ""
        try:
            crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            crypt32.CryptUnprotectData.argtypes = [
                ctypes.POINTER(_DataBlob),
                ctypes.POINTER(wintypes.LPWSTR),
                ctypes.POINTER(_DataBlob),
                wintypes.LPVOID,
                wintypes.LPVOID,
                wintypes.DWORD,
                ctypes.POINTER(_DataBlob),
            ]
            crypt32.CryptUnprotectData.restype = wintypes.BOOL
            kernel32.LocalFree.argtypes = [wintypes.HLOCAL]
            kernel32.LocalFree.restype = wintypes.HLOCAL
            
            encrypted = base64.b64decode(encrypted_val.encode("ascii"))
            encrypted_buffer = ctypes.create_string_buffer(encrypted)
            in_blob = _DataBlob(len(encrypted), ctypes.cast(encrypted_buffer, ctypes.POINTER(ctypes.c_byte)))
            out_blob = _DataBlob()
            
            if not crypt32.CryptUnprotectData(
                ctypes.byref(in_blob),
                None,
                None,
                None,
                None,
                0,
                ctypes.byref(out_blob),
            ):
                raise ctypes.WinError(ctypes.get_last_error())
            try:
                raw = ctypes.string_at(out_blob.pbData, out_blob.cbData)
                return raw.decode("utf-8")
            finally:
                kernel32.LocalFree(out_blob.pbData)
        except Exception as e:
            print(f"Error executing DPAPI unprotect: {e}")
            return ""
            
    elif backend == "plain":
        try:
            return base64.b64decode(encrypted_val.encode("ascii")).decode("utf-8")
        except Exception as e:
            print(f"Error decoding plain secret: {e}")
            return ""
            
    return str(encrypted_val)
