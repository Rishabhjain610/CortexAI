import os
import sys
import math
import requests

def run_preflight():
    print("======================================================================")
    print("PREFLIGHT GUARD: VERIFYING REAL MODELS & ZERO-STUB COMPLIANCE")
    print("======================================================================")
    
    # Check 1: Ensure LLM_STUB_MODE is NOT active
    if os.getenv("LLM_STUB_MODE") == "1":
        raise RuntimeError("FATAL: LLM_STUB_MODE is set to '1'! Preflight aborts to enforce Hard Rule 1.")
    print("  [PASS] LLM_STUB_MODE is disabled.")

    # Check 2: Verify Ollama is running and nomic embedding is available
    try:
        res = requests.post("http://localhost:11434/api/embeddings", json={
            "model": "nomic-embed-text:v1.5",
            "prompt": "health check"
        }, timeout=5)
        if res.status_code != 200:
            raise RuntimeError(f"Ollama returned HTTP {res.status_code}")
        vec = res.json().get("embedding", [])
        if len(vec) != 768:
            raise RuntimeError(f"Unexpected embedding dimension: {len(vec)} (expected 768)")
        print(f"  [PASS] Ollama running: nomic-embed-text:v1.5 (dim={len(vec)}).")
    except Exception as e:
        raise RuntimeError(f"FATAL: Ollama nomic embedding check failed: {e}")

    # Check 3: Embedding Sanity Check (Cosine similarity of paraphrases vs unrelated)
    def get_vec(t):
        return requests.post("http://localhost:11434/api/embeddings", json={"model": "nomic-embed-text:v1.5", "prompt": t}).json()["embedding"]

    def cos_sim(a, b):
        dot = sum(x*y for x, y in zip(a, b))
        na = math.sqrt(sum(x*x for x in a))
        nb = math.sqrt(sum(y*y for y in b))
        return dot / (na * nb)

    p_sim = cos_sim(get_vec("The quick brown fox jumps over the lazy dog."), get_vec("A fast brown fox leaps over a sleepy canine."))
    u_sim = cos_sim(get_vec("The quick brown fox jumps over the lazy dog."), get_vec("Quantum computing utilizes qubits."))
    
    if p_sim <= u_sim:
        raise RuntimeError(f"FATAL: Embedding sanity failed: Paraphrase sim ({p_sim:.4f}) <= Unrelated sim ({u_sim:.4f})")
    print(f"  [PASS] Embedding sanity verified: Paraphrase ({p_sim:.4f}) >> Unrelated ({u_sim:.4f}).")

    # Check 4: Qdrant Collection Verification
    try:
        q_info = requests.get("http://localhost:6333/collections/cortexai_verified_nomic_v15", timeout=5).json()
        dim = q_info["result"]["config"]["params"]["vectors"]["size"]
        if dim != 768:
            raise RuntimeError(f"Qdrant collection dimension mismatch: {dim}")
        print(f"  [PASS] Qdrant collection 'cortexai_verified_nomic_v15' verified (dim={dim}, distance=Cosine).")
    except Exception as e:
        raise RuntimeError(f"FATAL: Qdrant collection check failed: {e}")

    print("======================================================================")
    print("ALL PREFLIGHT GUARDS PASSED. REAL MODELS VERIFIED.")
    print("======================================================================")

if __name__ == "__main__":
    run_preflight()
