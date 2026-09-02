import urllib.request
import json
import os

key = "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"
models = ["meta/llama-3.1-70b-instruct", "meta/llama-3.1-8b-instruct", "meta/llama3-70b-instruct"]

url = "https://integrate.api.nvidia.com/v1/chat/completions"

for model in models:
    data = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 10
    }).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    })
    try:
        with urllib.request.urlopen(req) as response:
            print(f"SUCCESS: {model}")
            break
    except Exception as e:
        print(f"FAILED: {model} - {e}")
