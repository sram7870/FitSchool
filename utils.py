# utils.py
import os
import requests
from typing import Optional

OPENROUTER_API_KEY = os.environ.get("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")
OPENROUTER_URL = os.environ.get("OPENROUTER_URL", "https://openrouter.ai/api/v1")

def openrouter_explain(prompt: str) -> Optional[str]:
    """
    Send a prompt to OpenRouter to get an explainable natural language explanation.
    This is server-only. DO NOT embed API keys in client JS.
    Replace endpoint & payload format with the actual OpenRouter API contract you use.
    """
    if not OPENROUTER_API_KEY:
        return None
    # Minimal example - adapt to your OpenRouter usage (chat completion, model name, etc.)
    endpoint = OPENROUTER_URL.rstrip("/") + "/responses"
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": "gpt-4o-mini",  # example; change to your chosen model route
        "input": prompt,
        "max_tokens": 256,
        "temperature": 0.2
    }
    try:
        r = requests.post(endpoint, json=payload, headers=headers, timeout=20)
        r.raise_for_status()
        data = r.json()
        # The structure below is placeholder; adapt to actual response format.
        if "output" in data:
            return data["output"]
        # fallback: use 'choices' format if similar to OpenAI responses
        if "choices" in data and len(data["choices"]) > 0:
            return data["choices"][0].get("message", {}).get("content", "")
        return None
    except Exception as e:
        # log in server logs; don't crash on explainability failure
        print("OpenRouter explain error:", e)
        return None

def allowed_file(filename: str, ext_whitelist=None) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    if ext_whitelist is None:
        ext_whitelist = {"png", "jpg", "jpeg", "mp4", "mov", "mkv", "webm"}
    return ext in ext_whitelist
