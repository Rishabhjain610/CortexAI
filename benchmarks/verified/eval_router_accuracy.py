"""
CortexAI Verified Benchmark Suite - Phase 3: Router Accuracy After Fix (Real Models)
Evaluates all 80 evaluation prompts across 6 intents against Layer 2 heuristics and Layer 3 Real Gemini Fallback.
"""

import os
import re
import json
import time
import hashlib
import urllib.request
import dotenv

dotenv.load_dotenv("backend/services/agent/.env")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing from backend/services/agent/.env")

CACHE_PATH = "benchmarks/results/verified/cache.json"
RAW_OUT_PATH = "benchmarks/results/verified/raw/router_accuracy_raw.json"

os.makedirs("benchmarks/results/verified/raw", exist_ok=True)
cache = {}
if os.path.exists(CACHE_PATH):
    try:
        cache = json.load(open(CACHE_PATH, "r", encoding="utf-8"))
    except Exception:
        cache = {}

def save_cache():
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)

def call_gemini_router(prompt, system_instruction):
    cache_key = hashlib.sha256(f"ROUTER|{prompt}".encode()).hexdigest()
    if cache_key in cache:
        return cache[cache_key]["text"], cache[cache_key]["usage"], cache[cache_key].get("model", "cached")

    models_pool = ["models/gemini-3.1-flash-lite", "models/gemini-3-flash-preview"]
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {"temperature": 0.0}
    }

    time.sleep(1.0)
    for model_name in models_pool:
        url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={GEMINI_KEY}"
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=25) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    usage = data.get("usageMetadata", {})
                    cache[cache_key] = {"text": text, "usage": usage, "model": model_name}
                    save_cache()
                    return text, usage, model_name
            except urllib.error.HTTPError as e:
                if e.code in (429, 503, 500):
                    time.sleep(2.0)
                    break
            except Exception:
                time.sleep(2.0)

    return "chatAgent", {}, "fallback_default"

# 80 Prompts across 6 classes
BENCHMARK_PROMPTS = [
    # 1. codingAgent (15 prompts)
    {"prompt": "Write a Python script to calculate Fibonacci numbers using memoization", "expected": "codingAgent"},
    {"prompt": "Debug this JavaScript promise chain that returns undefined", "expected": "codingAgent"},
    {"prompt": "Write react component for an animated accordion dropdown", "expected": "codingAgent"},
    {"prompt": "Build app backend using Express and MongoDB with JWT auth", "expected": "codingAgent"},
    {"prompt": "Create website template with Tailwind CSS grid layout", "expected": "codingAgent"},
    {"prompt": "Write python function to reverse a singly linked list", "expected": "codingAgent"},
    {"prompt": "Fix code where binary search enters an infinite loop on duplicates", "expected": "codingAgent"},
    {"prompt": "How do I optimize this SQL query with multiple INNER JOINs?", "expected": "codingAgent"},
    {"prompt": "Implement a LRU Cache in TypeScript with O(1) get and put", "expected": "codingAgent"},
    {"prompt": "Write a Dockerfile for a multi-stage Go service build", "expected": "codingAgent"},
    {"prompt": "Write code to parse CSV files in Node.js streams", "expected": "codingAgent"},
    {"prompt": "How can I implement debounce and throttle in vanilla JS?", "expected": "codingAgent"},
    {"prompt": "Write a Rust function that handles concurrency using mpsc channels", "expected": "codingAgent"},
    {"prompt": "Create a CSS keyframe animation for a pulsing gradient button", "expected": "codingAgent"},
    {"prompt": "Explain time complexity of quicksort vs mergesort with code snippet", "expected": "codingAgent"},

    # 2. searchAgent (15 prompts)
    {"prompt": "What is the current weather forecast for Tokyo this weekend?", "expected": "searchAgent"},
    {"prompt": "Search google for the latest stock price of Apple Inc AAPL", "expected": "searchAgent"},
    {"prompt": "Find online who won the most recent Super Bowl MVP award", "expected": "searchAgent"},
    {"prompt": "Browse net for latest updates on NASA Artemis launch schedule", "expected": "searchAgent"},
    {"prompt": "What is the live exchange rate between USD and INR today?", "expected": "searchAgent"},
    {"prompt": "Search web for news about latest quantum computing breakthroughs", "expected": "searchAgent"},
    {"prompt": "Who is the current prime minister of the United Kingdom?", "expected": "searchAgent"},
    {"prompt": "What are the latest scores from Premier League matches yesterday?", "expected": "searchAgent"},
    {"prompt": "Look up on net current gas prices in California", "expected": "searchAgent"},
    {"prompt": "Find details on the upcoming solar eclipse visible in North America", "expected": "searchAgent"},
    {"prompt": "Search for top-rated electric vehicles released in 2026", "expected": "searchAgent"},
    {"prompt": "What is the latest consumer price index inflation rate reported by the Fed?", "expected": "searchAgent"},
    {"prompt": "Look up recent developments in the James Webb Space Telescope discoveries", "expected": "searchAgent"},
    {"prompt": "Search net for who won yesterday's NBA game between Lakers and Celtics", "expected": "searchAgent"},
    {"prompt": "Current status of the international space station mission", "expected": "searchAgent"},

    # 3. imageAgent (11 prompts)
    {"prompt": "Draw a futuristic cyberpunk city with neon reflections in rain", "expected": "imageAgent"},
    {"prompt": "Generate image of a cute baby panda playing acoustic guitar", "expected": "imageAgent"},
    {"prompt": "Create photo of a cozy Scandinavian living room with fireplace", "expected": "imageAgent"},
    {"prompt": "Sketch a pencil portrait of an elderly sea captain", "expected": "imageAgent"},
    {"prompt": "Generate photo of sunset over snow-capped alpine mountains", "expected": "imageAgent"},
    {"prompt": "Picture of an astronaut riding a horse on Mars, digital art", "expected": "imageAgent"},
    {"prompt": "Illustration of a mystical forest with bioluminescent mushrooms", "expected": "imageAgent"},
    {"prompt": "Make an image of a vintage red sports car driving along the Amalfi coast", "expected": "imageAgent"},
    {"prompt": "Paint a watercolor landscape of Japanese cherry blossoms in spring", "expected": "imageAgent"},
    {"prompt": "Render image of an isometric steampunk laboratory", "expected": "imageAgent"},
    {"prompt": "Create an image of an ancient library with floating glowing books", "expected": "imageAgent"},

    # 4. pptAgent (12 prompts)
    {"prompt": "Create a 5 slide ppt presentation on Q3 marketing strategy", "expected": "pptAgent"},
    {"prompt": "Make a presentation about renewable energy trends for investors", "expected": "pptAgent"},
    {"prompt": "Generate powerpoint slides explaining microservices architecture", "expected": "pptAgent"},
    {"prompt": "Create a pitch deck presentation for a healthcare AI startup", "expected": "pptAgent"},
    {"prompt": "Design a 6 slide presentation covering quarterly sales metrics", "expected": "pptAgent"},
    {"prompt": "Build a slideshow about modern supply chain logistics", "expected": "pptAgent"},
    {"prompt": "Prepare presentation slides on cybersecurity best practices for remote teams", "expected": "pptAgent"},
    {"prompt": "Create a ppt overview of agile scrum methodology", "expected": "pptAgent"},
    {"prompt": "Make presentation on cloud migration roadmap with key milestones", "expected": "pptAgent"},
    {"prompt": "Generate powerpoint deck for employee onboarding workshop", "expected": "pptAgent"},
    {"prompt": "Design slide presentation summarizing fintech industry growth", "expected": "pptAgent"},
    {"prompt": "Create slides for a keynote speech on future of generative AI", "expected": "pptAgent"},

    # 5. pdfAgent (12 prompts)
    {"prompt": "Generate a PDF invoice for freelance web development consulting services", "expected": "pdfAgent"},
    {"prompt": "Create a PDF resume for a Senior Software Engineer with 8 years experience", "expected": "pdfAgent"},
    {"prompt": "Format a PDF contract agreement for independent contractor services", "expected": "pdfAgent"},
    {"prompt": "Generate a PDF receipt with itemized billing for hardware equipment", "expected": "pdfAgent"},
    {"prompt": "Create a professional PDF document outlining the privacy policy", "expected": "pdfAgent"},
    {"prompt": "Generate PDF monthly financial statement with balance sheet summary", "expected": "pdfAgent"},
    {"prompt": "Create a PDF purchase order document with vendor details and line items", "expected": "pdfAgent"},
    {"prompt": "Format a clean PDF CV for an academic researcher in neuroscience", "expected": "pdfAgent"},
    {"prompt": "Generate a PDF certificate of completion for the python bootcamp course", "expected": "pdfAgent"},
    {"prompt": "Create a formal PDF resignation letter with standard two weeks notice", "expected": "pdfAgent"},
    {"prompt": "Generate a PDF nondisclosure agreement NDA template for partners", "expected": "pdfAgent"},
    {"prompt": "Create a PDF job offer letter with salary breakdown and benefits", "expected": "pdfAgent"},

    # 6. chatAgent (15 prompts)
    {"prompt": "Hello! How are you doing today?", "expected": "chatAgent"},
    {"prompt": "What is 25 * 4?", "expected": "chatAgent"},
    {"prompt": "Tell me a funny dad joke about computers", "expected": "chatAgent"},
    {"prompt": "Can you explain the philosophical concept of Plato's Cave allegory?", "expected": "chatAgent"},
    {"prompt": "What are some tips for maintaining work life balance?", "expected": "chatAgent"},
    {"prompt": "What is the difference between empathy and sympathy?", "expected": "chatAgent"},
    {"prompt": "Tell me 15 + 47", "expected": "chatAgent"},
    {"prompt": "Can you write a short poem about autumn leaves falling?", "expected": "chatAgent"},
    {"prompt": "How can I improve my public speaking and confidence?", "expected": "chatAgent"},
    {"prompt": "Explain what Occam's Razor means with an everyday example", "expected": "chatAgent"},
    {"prompt": "What are good habits for developing mental focus while studying?", "expected": "chatAgent"},
    {"prompt": "If you could travel anywhere in time, what era would you choose and why?", "expected": "chatAgent"},
    {"prompt": "What is the meaning of the proverb 'A stitch in time saves nine'?", "expected": "chatAgent"},
    {"prompt": "Give me three thoughtful conversation starters for a dinner party", "expected": "chatAgent"},
    {"prompt": "Good morning! Hope you have a wonderful day ahead.", "expected": "chatAgent"}
]

def simulate_router(prompt):
    cleanPrompt = (prompt or "").strip().lower()

    def matchKeyword(keyword):
        escaped = re.escape(keyword)
        regex = re.compile(rf"\b{escaped}s?\b", re.I)
        return bool(regex.search(cleanPrompt))

    # 1. Image generation keywords
    imageKeywords = [
        "draw", "paint", "sketch", "illustration",
        "generate image", "generate a image", "generate an image", "generate images",
        "create image", "create a image", "create an image", "create images",
        "make image", "make a image", "make an image", "make images",
        "create photo", "create a photo", "generate photo", "generate a photo",
        "picture of", "image of", "photo of", "art of",
        "render image", "design image"
    ]
    if any(matchKeyword(k) for k in imageKeywords):
        return "imageAgent", "Layer 2: Keyword Heuristic", 0

    # 2. Explicit search keywords
    explicitSearchKeywords = [
        "from net", "form net", "from web", "form web", "search net", "search web", "google", "on net", "on web",
        "online", "tavily", "browse net", "browse web", "find online", "search for", "look up on net", "search google",
        "search", "internet", "from internet", "form internet", "on internet", "net search", "web search"
    ]
    if any(matchKeyword(k) for k in explicitSearchKeywords):
        return "searchAgent", "Layer 2: Keyword Heuristic", 0

    # 3. Coding keywords
    codingKeywords = [
        "write code", "write a code", "write python", "write javascript", "write html", "write css", "write react",
        "build app", "create website", "create webpage", "debug code", "fix code", "program in", "coding script"
    ]
    if any(matchKeyword(k) for k in codingKeywords):
        return "codingAgent", "Layer 2: Keyword Heuristic", 0

    # 4. PPT keywords
    pptKeywords = ["ppt", "pptx", "presentation", "presentations", "presntation", "presenation", "presentaton", "slide", "slides", "powerpoint", "deck", "slideshow"]
    if any(matchKeyword(k) for k in pptKeywords):
        return "pptAgent", "Layer 2: Keyword Heuristic", 0

    # 5. Math query check
    isMathQuery = bool(re.search(r"^[\d\s\+\-\*\/\(\)\.]{3,}$", cleanPrompt) or re.search(r"^\d+\s*[\+\-\*\/]\s*\d+$", cleanPrompt) or re.search(r"^\s*(tell|what|calculate|compute)?\s*(me)?\s*\d+\s*[\+\-\*\/]\s*\d+\s*$", cleanPrompt, re.I))
    if isMathQuery:
        return "chatAgent", "Layer 2: Math Heuristic", 0

    # 6. Document & Search keywords
    docKeywords = ["pdf", "pdfs", "document", "documents", "file", "files", "resume", "cv", "uploaded", "paper", "cgpa", "marks", "grade", "gpa"]
    hasDocKeyword = any(matchKeyword(k) for k in docKeywords)

    searchKeywords = [
        "search", "google", "tavily", "weather", "news", "current time", "time in", 
        "price", "rate", "cost", "how much", "buy", "shop", "stock", "shares", 
        "live", "today", "yesterday", "forecast", "who is", "who was", "biography",
        "bio of", "born in", "born on", "spouse", "career of", "gather info", 
        "gather information", "research", "lookup", "look up", "info", "information", "details", 
        "find out", "find details", "current", "latest", "recent", "about",
        "from net", "form net", "from web", "form web", "on net", "on web", "net", "internet"
    ]
    if not hasDocKeyword and any(matchKeyword(k) for k in searchKeywords):
        return "searchAgent", "Layer 2: Keyword Heuristic", 0

    # 7. PDF creation keywords
    topicIndicators = ["on", "about", "compare", "how to", "history", "explain", "topic", "information", "details"]
    pdfKeywords = ["pdf", "pdfs", "document", "documents", "file", "files", "invoice", "resume", "cv", "paper"]
    if any(matchKeyword(k) for k in pdfKeywords):
        if any(matchKeyword(k) for k in topicIndicators):
            return "searchAgent", "Layer 2: Topic-PDF Heuristic", 0
        return "pdfAgent", "Layer 2: Keyword Heuristic", 0

    # Layer 3: LLM Fallback
    system_prompt = (
        "You are a routing agent for CortexAI. Classify the user's prompt into one of these agents:\n"
        "- chatAgent: General conversation, greetings, jokes, opinions, chit-chat, math, philosophy\n"
        "- searchAgent: Questions needing live web info, current events, who/what/where queries, facts about people/places\n"
        "- codingAgent: Writing, debugging, or explaining code, programming, algorithms, database queries\n"
        "- imageAgent: Generating, drawing, or creating images/photos/art\n"
        "- pdfAgent: Creating or working with PDF documents, resumes, reports\n"
        "- pptAgent: Creating presentations or slide decks\n\n"
        "Reply with ONLY the agent name (e.g. chatAgent or codingAgent). No explanation."
    )

    llm_resp, usage, model_name = call_gemini_router(prompt, system_prompt)
    clean_resp = llm_resp.strip().replace("'", "").replace('"', "").replace("`", "")
    valid_agents = ["chatAgent", "codingAgent", "imageAgent", "pdfAgent", "pptAgent", "searchAgent"]
    
    tokens = usage.get("totalTokenCount", 0)
    for v in valid_agents:
        if v.lower() in clean_resp.lower():
            return v, f"Layer 3: LLM Fallback ({model_name})", tokens
            
    return "chatAgent", f"Layer 3: Safe Fallback ({model_name})", tokens

def run_router_eval():
    print("=======================================================")
    print("PHASE 3: ROUTER ACCURACY EVALUATION (REAL MODELS)")
    print("=======================================================")

    results = []
    correct_count = 0
    layer2_count = 0
    layer3_count = 0
    total_tokens = 0

    for idx, item in enumerate(BENCHMARK_PROMPTS):
        p = item["prompt"]
        expected = item["expected"]
        
        predicted, layer, tokens = simulate_router(p)
        total_tokens += tokens
        
        is_correct = (predicted == expected)
        if is_correct:
            correct_count += 1
            
        if "Layer 2" in layer:
            layer2_count += 1
        else:
            layer3_count += 1

        results.append({
            "id": idx + 1,
            "prompt": p,
            "expected_agent": expected,
            "predicted_agent": predicted,
            "decision_layer": layer,
            "is_correct": is_correct,
            "tokens": tokens
        })
        status_sym = "[OK]" if is_correct else "[MISMATCH]"
        print(f"  [{idx+1:02d}/80] {status_sym} Expected: {expected:<12} | Predicted: {predicted:<12} | {layer}", flush=True)

    accuracy = correct_count / len(BENCHMARK_PROMPTS)

    summary = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_prompts": len(BENCHMARK_PROMPTS),
        "correct_predictions": correct_count,
        "mismatches": len(BENCHMARK_PROMPTS) - correct_count,
        "accuracy": round(accuracy, 4),
        "accuracy_percent": f"{accuracy*100:.1f}%",
        "layer2_heuristic_decisions": layer2_count,
        "layer3_llm_decisions": layer3_count,
        "total_provider_tokens": total_tokens,
        "prompt_results": results
    }

    with open(RAW_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    raw_bytes = open(RAW_OUT_PATH, "rb").read()
    raw_sha = hashlib.sha256(raw_bytes).hexdigest()
    with open("benchmarks/results/verified/manifest.sha256", "a", encoding="utf-8") as f:
        f.write(f"{raw_sha}  router_accuracy_raw.json\n")

    print("\n=======================================================")
    print("PHASE 3 ROUTER ACCURACY SUMMARY (REAL MODELS)")
    print("=======================================================")
    print(f"Total Evaluated Prompts: {len(BENCHMARK_PROMPTS)}")
    print(f"Correctly Routed: {correct_count} / {len(BENCHMARK_PROMPTS)} ({accuracy*100:.1f}%)")
    print(f"Layer 2 Deterministic Heuristic Decisions: {layer2_count} ({layer2_count/len(BENCHMARK_PROMPTS)*100:.1f}%)")
    print(f"Layer 3 LLM Fallback Decisions: {layer3_count} ({layer3_count/len(BENCHMARK_PROMPTS)*100:.1f}%)")
    print(f"Total Provider Tokens Consumed: {total_tokens}")
    print(f"Raw Output: {RAW_OUT_PATH} (SHA256: {raw_sha})")
    print("=======================================================")

if __name__ == "__main__":
    run_router_eval()
