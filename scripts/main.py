import requests
import json
import time

class CopilotBackend:
    def __init__(self, model="qwen2.5:0.5b-base", url="http://localhost:11434/api/generate"):
        self.model = model
        self.url = url
        # Qwen FIM tokens (standard for many models, verify if your specific version differs)
        self.FIM_PREFIX = "<|fim_prefix|>"
        self.FIM_SUFFIX = "<|fim_suffix|>"
        self.FIM_MIDDLE = "<|fim_middle|>"

    def complete(self, prefix: str, suffix: str = None, max_tokens: int = 64, n: int = 1, temperature: float = 0.1):
        """
        Generates code completion candidates.
        """
        
        if suffix:
            # FIM mode (PSM format)
            # Note: This requires the model to know these special tokens.
            # If Qwen base treats them as text, it might chat. 
            prompt = f"{self.FIM_PREFIX}{prefix}{self.FIM_SUFFIX}{suffix}{self.FIM_MIDDLE}"
        else:
            # Standard prefix completion
            prompt = prefix

        payload = {
            "model": self.model,
            "prompt": prompt,
            "raw": True,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "top_p": 0.9,
                "stop": ["<|endoftext|>", "<|file_separator|>"]
            }
        }

        candidates = []
        latencies = []

        # Request loop for n candidates (Ollama currently doesn't support n > 1 in single request natively without sampling tricks, 
        # so we loop. For true copilot speed, n=1 is best)
        
        # Note: To get true diversity for n>1, we might need to bump temperature slightly or use a seed if supported/needed.
        # Here we just loop.
        
        for i in range(n):
            t0 = time.time()
            try:
                # Add seed to payload to vary results if temperature is 0, but here temp is 0.1
                # payload["options"]["seed"] = int(time.time() * 1000) 
                
                response = requests.post(self.url, json=payload, timeout=5) # fast timeout
                response.raise_for_status()
                
                # Parse
                res_json = response.json()
                content = res_json.get("response", "")
                
                # Strip potential trailing garbage if needed, but for FIM usually usage is raw
                candidates.append(content)
                
                dt = (time.time() - t0) * 1000
                latencies.append(dt)
                
            except Exception as e:
                print(f"Error requesting completion {i+1}/{n}: {e}")
                
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        return avg_latency, candidates

if __name__ == "__main__":
    # Test Configuration
    copilot = CopilotBackend(model="qwen2.5:3b")
    
    # 1. Test Simple Prefix Completion
    # print("\n--- Test 1: Simple Prefix ---")
    # prefix_code = "def fib(n):\n    if n <= 1:\n        return n\n    else:\n        return "
    # lat, cands = copilot.complete(prefix_code, max_tokens=32, n=1)
    
    # print(f"Latency: {lat:.1f}ms")
    # print(f"Prompt:\n{prefix_code}")
    # print(f"Completion:\n{cands[0] if cands else 'None'}")

    # 2. Test FIM Completion (Insertion)
    print("\n--- Test 2: FIM (Insertion) ---")
    # Inserting missing condition in a binary search
    # prefix_fim = """def binary_search(arr, target):
    # low = 0
    # high = len(arr) - 1
    # while low <= high:
    #     mid = (low + high) // 2
    #     """
    # suffix_fim = """
    #         return mid
    #     elif arr[mid] < target:
    #         low = mid + 1
    #     else:
    #         high = mid - 1
    # return -1"""
    
    # lat, cands = copilot.complete(prefix_fim, suffix=suffix_fim, max_tokens=32, n=1)
    
    # print(f"Latency: {lat:.1f}ms")
    # print(f"Prompt (Prefix):\n{prefix_fim}")
    # print(f"Completion:\n{cands[0] if cands else 'None'}")
    # print(f"Suffix:\n{suffix_fim}")

    # 3. Test Chinese Prefix Completion
    # print("\n--- Test 3: Chinese Prefix ---")
    # prefix_cn = "# 用 Python 寫一個計算費波那契數列的函式\ndef fib(n):"
    # lat, cands = copilot.complete(prefix_cn, max_tokens=64, n=1)
    
    # print(f"Latency: {lat:.1f}ms")
    # print(f"Prompt:\n{prefix_cn}")
    # print(f"Completion:\n{cands[0] if cands else 'None'}")

    # 4. Test Chinese FIM Completion
    # print("\n--- Test 4: Chinese FIM ---")
    # prefix_cn_fim = "人工智能的定義是"
    # suffix_cn_fim = "，它將改變我們的生活。"
    
    # lat, cands = copilot.complete(prefix_cn_fim, suffix=suffix_cn_fim, max_tokens=32, n=1)
    
    # print(f"Latency: {lat:.1f}ms")
    # print(f"Prompt (Prefix):\n{prefix_cn_fim}")
    # print(f"Completion:\n{cands[0] if cands else 'None'}")
    # print(f"Suffix:\n{suffix_cn_fim}")

    # 5. 中文接龍
    print("\n--- Test 5: Chinese Dragon ---")
    prefix_cn_dragon = '''這就是 Continue / Twinny 這些插件在背後做的事情（它們不會送出 User/Assistant 標籤，只會送出 Raw Text）。

結論
不要被終端機騙了：終端機是用來聊天的，不是用來測補全的。

下一步：直接去 VS Code 安裝 Continue 插件，把模型設為 qwen2.5:1.5b，然後在編輯器裡打字。那才是真正的測試環境。

如果 VS Code 裡它還是會講廢話，那就依照 方法一，改用 qwen2.5-coder:1.5b，它通常比較「冷酷」，只做事不聊天。
我想要嘗試看看去做'''
    suffix_cn_dragon = ""
    
    lat, cands = copilot.complete(prefix_cn_dragon, suffix=suffix_cn_dragon, max_tokens=4, n=1)
    
    print(f"Latency: {lat:.1f}ms")
    print(f"Prompt (Prefix):\n{prefix_cn_dragon}")
    print(f"Completion:\n{cands[0] if cands else 'None'}")
    print(f"Suffix:\n{suffix_cn_dragon}")
    
