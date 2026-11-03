with open("backend/services/agent/config/model.js", "r", encoding="utf-8") as f:
    s = f.read()

s = s.replace('model: "qwen/qwen3.6-27b",', 'model: "qwen/qwen3.8-27b",')
s = s.replace('model: "llama-3.3-70b-versatile",', 'model: "openai/gpt-oss-120b",')

with open("backend/services/agent/config/model.js", "w", encoding="utf-8") as f:
    f.write(s)

print("Updated Groq models in model.js")

