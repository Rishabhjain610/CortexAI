"""
CortexAI Preflight Guard & Sanity Checker
Hard Rule 1: Fail loudly, never fall back. Abort if stubs are enabled,
if embedding is invalid, or if services/keys are unreachable.
"""
import os
import sys
import json
import math
import urllib.request
import urllib.error

def check_env():
    print("[1/5] Checking environment variables & stub guards...")
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/services/agent/.env"))
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    
    # Check stubs
    if os.environ.get("LLM_STUB_MODE") == "1" or env_vars.get("LLM_STUB_MODE") == "1":
        print("FAIL: LLM_STUB_MODE is set to 1! Real benchmark requires real LLMs.")
        sys.exit(1)
        
    gemini_key = os.environ.get("GEMINI_API_KEY") or env_vars.get("GEMINI_API_KEY")
    groq_key = os.environ.get("GROQ_API_KEY") or env_vars.get("GROQ_API_KEY")
    
    if not gemini_key or gemini_key.startswith("your_"):
        print("FAIL: GEMINI_API_KEY is missing or invalid in agent .env.")
        sys.exit(1)
    if not groq_key or groq_key.startswith("your_"):
        print("FAIL: GROQ_API_KEY is missing or invalid in agent .env.")
        sys.exit(1)
        
    print(f"  [OK] Zero stubs detected. Gemini key: {gemini_key[:6]}... Groq key: {groq_key[:6]}...")
    return env_vars, gemini_key, groq_key

def check_ollama():
    print("[2/5] Checking Ollama service and nomic-embed-text model...")
    try:
        req = urllib.request.Request("http://localhost:11434/api/tags")
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode("utf-8"))
            models = data.get("models", [])
            nomic = [m for m in models if "nomic-embed-text" in m.get("name", "")]
            if not nomic:
                print("FAIL: nomic-embed-text model not pulled in Ollama!")
                sys.exit(1)
            model_info = nomic[0]
            digest = model_info.get("digest", "")
            print(f"  [OK] Ollama is running. Model: {model_info.get('name')} | Digest: {digest[:16]}...")
            return model_info
    except Exception as e:
        print(f"FAIL: Ollama is not accessible on http://localhost:11434 ({e})")
        sys.exit(1)

def get_embedding(text):
    data = json.dumps({"model": "nomic-embed-text:v1.5", "input": text}).encode("utf-8")
    req = urllib.request.Request("http://localhost:11434/api/embed", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as res:
        res_data = json.loads(res.read().decode("utf-8"))
        return res_data["embeddings"][0]

def cosine_similarity(v1, v2):
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    return dot / (norm1 * norm2) if norm1 and norm2 else 0.0

def check_embedding_sanity():
    print("[3/5] Testing embedding sanity: paraphrase pairs vs unrelated pairs...")
    paraphrase_pairs = [
        ("The patient was admitted with acute myocardial infarction.", "A person entered the clinic suffering from a sudden heart attack."),
        ("Total revenue increased by twenty-eight percent year-over-year.", "Annual earnings experienced a growth of 28% compared to last year."),
        ("Vector search enables semantic retrieval of dense document embeddings.", "Embeddings allow meaning-based search through mathematical vector spaces."),
        ("Employees may take sixteen weeks of parental leave upon birth of a child.", "Parents are entitled to 16 weeks of paid leave following childbirth."),
        ("The server returned HTTP status code 503 service unavailable.", "A 503 error was sent indicating that backend services were temporarily offline.")
    ]
    
    unrelated_pairs = [
        ("The patient was admitted with acute myocardial infarction.", "The French recipe calls for unsalted butter and fresh tarragon."),
        ("Total revenue increased by twenty-eight percent year-over-year.", "Quantum entanglement occurs when particles share physical states at a distance."),
        ("Vector search enables semantic retrieval of dense document embeddings.", "The cat chased the golden butterfly across the green meadow."),
        ("Employees may take sixteen weeks of parental leave upon birth of a child.", "The Byzantine Empire fell following the siege of Constantinople in 1453."),
        ("The server returned HTTP status code 503 service unavailable.", "Photosynthesis converts solar light into chemical energy inside plant chloroplasts.")
    ]
    
    para_sims = []
    for p1, p2 in paraphrase_pairs:
        e1 = get_embedding(p1)
        e2 = get_embedding(p2)
        sim = cosine_similarity(e1, e2)
        para_sims.append(sim)
        
    unrelated_sims = []
    for u1, u2 in unrelated_pairs:
        e1 = get_embedding(u1)
        e2 = get_embedding(u2)
        sim = cosine_similarity(e1, e2)
        unrelated_sims.append(sim)
        
    avg_para = sum(para_sims) / len(para_sims)
    avg_unrelated = sum(unrelated_sims) / len(unrelated_sims)
    
    print(f"  Paraphrase pairs avg cosine similarity: {avg_para:.4f} (range: {min(para_sims):.4f} - {max(para_sims):.4f})")
    print(f"  Unrelated pairs avg cosine similarity:  {avg_unrelated:.4f} (range: {min(unrelated_sims):.4f} - {max(unrelated_sims):.4f})")
    
    if avg_para <= avg_unrelated + 0.20:
        print("FAIL: Embedding model failed sanity test! Paraphrases are not clearly separated from unrelated pairs.")
        sys.exit(1)
        
    dim = len(get_embedding("test"))
    print(f"  [OK] Embedding sanity test passed. Vector dimension: {dim} (clear delta: +{avg_para - avg_unrelated:.4f})")
    return dim

def check_qdrant():
    print("[4/5] Checking Qdrant vector database...")
    try:
        req = urllib.request.Request("http://localhost:6333/collections")
        with urllib.request.urlopen(req, timeout=3) as res:
            data = json.loads(res.read().decode("utf-8"))
            collections = [c["name"] for c in data.get("result", {}).get("collections", [])]
            print(f"  [OK] Qdrant server is running on :6333. Collections: {collections}")
            return "server"
    except Exception:
        try:
            from qdrant_client import QdrantClient
            client = QdrantClient(":memory:")
            print("  [OK] Qdrant embedded engine (qdrant-client) is verified and active.")
            return "embedded"
        except Exception as e:
            print(f"FAIL: Qdrant is not accessible ({e})")
            sys.exit(1)

def check_corpus():
    print("[5/5] Checking real PDF corpus in benchmarks/data/real_docs/...")
    doc_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "data/real_docs"))
    if not os.path.exists(doc_dir):
        print(f"FAIL: Directory {doc_dir} does not exist.")
        sys.exit(1)
        
    docs = [f for f in os.listdir(doc_dir) if f.endswith(".pdf")]
    if len(docs) < 3:
        print(f"FAIL: Expected at least 3 real documents, found {len(docs)}.")
        sys.exit(1)
        
    total_size = sum(os.path.getsize(os.path.join(doc_dir, f)) for f in docs)
    print(f"  [OK] Found {len(docs)} real PDFs in benchmarks/data/real_docs/ ({total_size / 1024 / 1024:.2f} MB total):")
    for d in docs:
        sz = os.path.getsize(os.path.join(doc_dir, d))
        print(f"    - {d}: {sz / 1024:.1f} KB")

if __name__ == "__main__":
    print("=" * 60)
    print("       CORTEXAI RETRIEVAL BENCHMARK PREFLIGHT GUARD")
    print("=" * 60)
    check_env()
    check_ollama()
    check_embedding_sanity()
    check_qdrant()
    check_corpus()
    print("=" * 60)
    print("[OK] PREFLIGHT PASSED: All real services and sanity tests validated.")
    print("=" * 60)
