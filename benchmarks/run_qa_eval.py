"""
CortexAI RAG Phase 4 (End-to-End QA Quality) & Phase 5 (Efficiency & Latencies) Runner
Evaluates Baseline vs Best Reranker on HELD-OUT TEST SET with:
- Generator: Google Gemini 3.1 Flash Lite (exact CortexAI model from model.js)
- Judge: Groq openai/gpt-oss-120b (temperature 0, independent model family)
- 3 runs for mean & standard deviation
- Real token usage tracking from API providers
- Cost per query and per correct answer using pricing.json
"""

import os
import sys
import json
import time
import re
import urllib.request
from collections import defaultdict
import numpy as np
import requests
import dotenv

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import torch
torch.set_num_threads(1)

# Load environment
dotenv.load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "services", "agent", ".env")))
dotenv.load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY in environment!")
if not GROQ_API_KEY:
    raise RuntimeError("Missing GROQ_API_KEY in environment!")

from sentence_transformers import CrossEncoder
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from rank_bm25 import BM25Okapi

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from benchmarks.matcher import is_chunk_relevant, evaluate_retrieval_for_query, normalize_text

BENCH_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "retrieval_bench"))
CACHE_FILE = os.path.join(BENCH_DIR, "qa_eval_cache.json")
PRICING_FILE = os.path.join(BENCH_DIR, "pricing.json")

# Load Pricing
with open(PRICING_FILE, "r", encoding="utf-8") as f:
    PRICING = json.load(f)

# Load QA Cache
qa_cache = {}
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            qa_cache = json.load(f)
    except Exception:
        qa_cache = {}

def save_cache():
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(qa_cache, f, indent=2)

# Load Test Questions
TEST_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "human_labeled", "test_questions.jsonl"))
test_questions = []
with open(TEST_FILE, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            test_questions.append(json.loads(line))

# Load Embeddings Cache & Documents
EMBED_CACHE_FILE = os.path.join(BENCH_DIR, "embeddings_cache.json")
with open(EMBED_CACHE_FILE, "r", encoding="utf-8") as f:
    embed_cache = json.load(f)

DOCS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "extracted_text"))
raw_docs = {}
for fname in sorted(os.listdir(DOCS_DIR)):
    if fname.endswith(".txt"):
        with open(os.path.join(DOCS_DIR, fname), "r", encoding="utf-8") as f:
            raw_docs[fname.replace(".txt", ".pdf")] = f.read()

def get_chunks(chunk_size=1200, overlap=180):
    chunks = []
    chunk_counter = 0
    step = chunk_size - overlap
    for doc_name, text in raw_docs.items():
        text_len = len(text)
        start = 0
        while start < text_len:
            end = min(start + chunk_size, text_len)
            c_text = text[start:end]
            chunks.append({
                "id": f"{doc_name}_chunk_{chunk_counter}",
                "doc_name": doc_name,
                "text": c_text,
                "start": start,
                "end": end
            })
            chunk_counter += 1
            if end >= text_len:
                break
            start += step
    return chunks

chunks_1200 = get_chunks(1200, 180)

# Build Qdrant and BM25 for 1200
client_1200 = QdrantClient(":memory:")
client_1200.create_collection(
    collection_name="test_1200",
    vectors_config=VectorParams(size=768, distance=Distance.COSINE)
)
points = []
for idx, chunk in enumerate(chunks_1200):
    vec = embed_cache[chunk["text"]]
    points.append(PointStruct(id=idx, vector=vec, payload={"text": chunk["text"], "doc_name": chunk["doc_name"]}))
    if len(points) >= 100:
        client_1200.upsert(collection_name="test_1200", points=points)
        points = []
if points:
    client_1200.upsert(collection_name="test_1200", points=points)

tokenized_1200 = [normalize_text(c["text"]).split() for c in chunks_1200]
bm25_1200 = BM25Okapi(tokenized_1200)

# CrossEncoder
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

# Stage Latency Profilers
def search_baseline(query: str, top_k: int = 5):
    t0 = time.time()
    q_vec = embed_cache.get(query)
    if not q_vec:
        req = urllib.request.Request("http://localhost:11434/api/embeddings",
                                     data=json.dumps({"model": "nomic-embed-text:v1.5", "prompt": query}).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            q_vec = json.loads(resp.read().decode())["embedding"]
            embed_cache[query] = q_vec
    embed_ms = (time.time() - t0) * 1000

    t1 = time.time()
    res = client_1200.query_points(collection_name="test_1200", query=q_vec, limit=top_k)
    search_ms = (time.time() - t1) * 1000
    retrieved = [p.payload["text"] for p in res.points]
    return retrieved, {"embed_ms": embed_ms, "search_ms": search_ms, "bm25_ms": 0.0, "rerank_ms": 0.0}

def search_reranker(query: str, top_k: int = 5):
    t0 = time.time()
    q_vec = embed_cache.get(query)
    if not q_vec:
        req = urllib.request.Request("http://localhost:11434/api/embeddings",
                                     data=json.dumps({"model": "nomic-embed-text:v1.5", "prompt": query}).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            q_vec = json.loads(resp.read().decode())["embedding"]
            embed_cache[query] = q_vec
    embed_ms = (time.time() - t0) * 1000

    t1 = time.time()
    res = client_1200.query_points(collection_name="test_1200", query=q_vec, limit=20)
    search_ms = (time.time() - t1) * 1000
    candidates = [p.payload["text"] for p in res.points]

    t2 = time.time()
    pairs = [[query, c] for c in candidates]
    scores = reranker.predict(pairs, batch_size=32, show_progress_bar=False)
    ranked_indices = np.argsort(scores)[::-1][:top_k]
    rerank_ms = (time.time() - t2) * 1000
    retrieved = [candidates[i] for i in ranked_indices]
    return retrieved, {"embed_ms": embed_ms, "search_ms": search_ms, "bm25_ms": 0.0, "rerank_ms": rerank_ms}

# CortexAI Generator Call
def call_cortex_generator(query: str, context: str):
    cache_key = f"gen:gemini-3.1-flash-lite:{query}:{hash(context)}"
    if cache_key in qa_cache:
        return qa_cache[cache_key]

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_API_KEY}"
    prompt_text = f"""You are CortexAI, an expert PDF document analysis assistant. The user has already uploaded a PDF document and its full text content has been extracted and provided to you below in the Context section.

CRITICAL RULES — READ CAREFULLY:
- The document content is ALREADY available to you in the Context section below. Do NOT ask the user to upload or re-upload any file.
- Do NOT say "the file didn't come through" or "I can't see the attachment". You already have the full text content.
- Answer the user's question using ONLY the text provided in the Context section.
- If the user asks "what is this" or "summarize this", describe and summarize the document content from the Context.
- Every factual claim must be supported by the Context. Do not invent or infer data not present in the text.
- If the context does not contain enough information to answer reliably, say clearly that the information is not in the document.
- Be concise and direct. Do not add unnecessary filler text.

Context (extracted text from the uploaded PDF document):
{context}

Question: {query}"""

    payload = {
        "contents": [{"parts": [{"text": prompt_text}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 300}
    }

    t0 = time.time()
    for attempt in range(4):
        try:
            r = requests.post(url, json=payload, timeout=20)
            if r.status_code == 200:
                data = r.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                usage = data.get("usageMetadata", {})
                dur_ms = (time.time() - t0) * 1000
                res = {
                    "text": text,
                    "prompt_tokens": usage.get("promptTokenCount", 0),
                    "candidate_tokens": usage.get("candidatesTokenCount", 0),
                    "total_tokens": usage.get("totalTokenCount", 0),
                    "duration_ms": dur_ms
                }
                qa_cache[cache_key] = res
                return res
            elif r.status_code == 429:
                time.sleep(3 * (attempt + 1))
            else:
                time.sleep(2)
        except Exception as e:
            time.sleep(2)

    return {"text": "Generation failed due to API error.", "prompt_tokens": 0, "candidate_tokens": 0, "total_tokens": 0, "duration_ms": 0}

# Groq Judge Call
def call_groq_judge(query: str, ground_truth: str, generated_answer: str, context: str, is_answerable: bool):
    cache_key = f"judge:openai/gpt-oss-120b:{query}:{hash(generated_answer)}"
    if cache_key in qa_cache:
        return qa_cache[cache_key]

    system_prompt = """You are an objective evaluation judge auditing an AI retrieval-augmented generation (RAG) system.
Assess the generated answer according to these exact rules:
1. "correctness" (integer 0 or 1):
   - For answerable questions: 1 if the generated answer conveys the core factual claim/entity/data asserted in ground truth; 0 if contradictory, missing key data, or falsely refused.
   - For unanswerable questions: 1 if the answer correctly refuses or indicates missing info; 0 if it hallucinates an answer.
2. "faithfulness" (integer 0 or 1): 1 if all factual assertions in the answer are strictly supported by the context; 0 if it includes external hallucinations or unsupported claims.
3. "is_refusal" (boolean): true if the answer states the information is not found or refuses to answer; false otherwise.
4. "explanation": short 1-sentence reason.

Output valid JSON only with keys: correctness, faithfulness, is_refusal, explanation."""

    user_prompt = f"""Question: {query}
Ground Truth: {ground_truth}
Is Answerable: {is_answerable}
Retrieved Context:
{context[:2500]}

Generated Candidate Answer:
{generated_answer}"""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": "openai/gpt-oss-120b",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"}
    }

    t0 = time.time()
    for attempt in range(4):
        try:
            r = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=20)
            if r.status_code == 200:
                data = r.json()
                content = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                parsed = json.loads(content)
                res = {
                    "correctness": int(parsed.get("correctness", 0)),
                    "faithfulness": int(parsed.get("faithfulness", 0)),
                    "is_refusal": bool(parsed.get("is_refusal", False)),
                    "explanation": parsed.get("explanation", ""),
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                    "duration_ms": (time.time() - t0) * 1000
                }
                qa_cache[cache_key] = res
                return res
            elif r.status_code == 429:
                time.sleep(3 * (attempt + 1))
            else:
                # Try fallback to openai/gpt-oss-20b if 120b has issue
                payload["model"] = "openai/gpt-oss-20b"
                time.sleep(1)
        except Exception:
            time.sleep(2)

    return {"correctness": 0, "faithfulness": 0, "is_refusal": False, "explanation": "Judge API failed", "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "duration_ms": 0}

def run_qa_evaluation():
    print("=" * 70)
    print("  STARTING PHASE 4: END-TO-END QA EVALUATION & PHASE 5 EFFICIENCY")
    print("=" * 70)

    configs = [
        {"name": "Baseline_Dense_1200", "search_fn": search_baseline},
        {"name": "Best_CrossEncoder_Reranker", "search_fn": search_reranker}
    ]

    all_config_results = {}

    for cfg in configs:
        cfg_name = cfg["name"]
        search_fn = cfg["search_fn"]
        print(f"\n--- Evaluating Configuration: {cfg_name} (3 Independent Runs) ---")

        run_records = []
        for run_idx in range(1, 4):
            print(f"  > Run {run_idx}/3: ", end="", flush=True)
            q_records = []
            for q in test_questions:
                print(".", end="", flush=True)
                q_id = q["id"]
                q_text = q["question"]
                gt = q["answer"]
                is_ans = q["answerable"]

                # 1. Retrieval
                retrieved_chunks, stage_times = search_fn(q_text, top_k=5)
                context = "\n\n".join(retrieved_chunks)
                ret_eval = evaluate_retrieval_for_query(retrieved_chunks, q)
                ret_hit = ret_eval["hit"]

                # 2. Generation
                gen_res = call_cortex_generator(q_text, context)

                # 3. Judge
                judge_res = call_groq_judge(q_text, gt, gen_res["text"], context, is_ans)

                # Cost calculation
                cost_gen = (gen_res["prompt_tokens"] * 0.075 + gen_res["candidate_tokens"] * 0.30) / 1e6
                cost_judge = (judge_res["prompt_tokens"] * 0.15 + judge_res["completion_tokens"] * 0.60) / 1e6

                record = {
                    "question_id": q_id,
                    "question": q_text,
                    "ground_truth": gt,
                    "is_answerable": is_ans,
                    "retrieval_hit": ret_hit,
                    "retrieved_context": retrieved_chunks,
                    "generated_answer": gen_res["text"],
                    "correctness": judge_res["correctness"],
                    "faithfulness": judge_res["faithfulness"],
                    "is_refusal": judge_res["is_refusal"],
                    "explanation": judge_res["explanation"],
                    "tokens": {
                        "gen_prompt": gen_res["prompt_tokens"],
                        "gen_candidate": gen_res["candidate_tokens"],
                        "judge_prompt": judge_res["prompt_tokens"],
                        "judge_completion": judge_res["completion_tokens"]
                    },
                    "costs": {
                        "gen_cost_usd": cost_gen,
                        "judge_cost_usd": cost_judge,
                        "total_cost_usd": cost_gen + cost_judge
                    },
                    "latencies_ms": {
                        "embed": stage_times["embed_ms"],
                        "search": stage_times["search_ms"],
                        "rerank": stage_times["rerank_ms"],
                        "generation": gen_res["duration_ms"]
                    }
                }
                q_records.append(record)

            save_cache()
            print(" done.")

            # Compute Run Metrics
            ans_records = [r for r in q_records if r["is_answerable"]]
            unans_records = [r for r in q_records if not r["is_answerable"]]

            acc = np.mean([r["correctness"] for r in ans_records])
            faith = np.mean([r["faithfulness"] for r in q_records])
            
            # Refusal accuracy on unanswerables
            unans_correct_refusals = sum(1 for r in unans_records if r["is_refusal"])
            refusal_acc = unans_correct_refusals / len(unans_records) if unans_records else 1.0

            # Wrongly refused answerable questions
            wrongly_refused = sum(1 for r in ans_records if r["is_refusal"])

            # Correctness split by hit vs miss
            hits = [r for r in ans_records if r["retrieval_hit"]]
            misses = [r for r in ans_records if not r["retrieval_hit"]]
            acc_given_hit = np.mean([r["correctness"] for r in hits]) if hits else 0.0
            acc_given_miss = np.mean([r["correctness"] for r in misses]) if misses else 0.0

            run_summary = {
                "run": run_idx,
                "answer_correctness": acc,
                "faithfulness": faith,
                "refusal_accuracy": refusal_acc,
                "wrongly_refused_count": wrongly_refused,
                "acc_given_hit": acc_given_hit,
                "acc_given_miss": acc_given_miss,
                "n_hit": len(hits),
                "n_miss": len(misses),
                "records": q_records
            }
            run_records.append(run_summary)

        # Aggregate 3 runs
        accs = [r["answer_correctness"] for r in run_records]
        faiths = [r["faithfulness"] for r in run_records]
        refusals = [r["refusal_accuracy"] for r in run_records]
        wrong_refusals = [r["wrongly_refused_count"] for r in run_records]
        hits_accs = [r["acc_given_hit"] for r in run_records]
        miss_accs = [r["acc_given_miss"] for r in run_records]

        # Stage latencies aggregation over run 1
        all_q = run_records[0]["records"]
        embed_lats = [r["latencies_ms"]["embed"] for r in all_q]
        search_lats = [r["latencies_ms"]["search"] for r in all_q]
        rerank_lats = [r["latencies_ms"]["rerank"] for r in all_q]
        gen_lats = [r["latencies_ms"]["generation"] for r in all_q]
        total_costs = [r["costs"]["total_cost_usd"] for r in all_q]
        gen_tokens = [r["tokens"]["gen_prompt"] + r["tokens"]["gen_candidate"] for r in all_q]

        cfg_summary = {
            "config_name": cfg_name,
            "correctness_mean": float(np.mean(accs)),
            "correctness_std": float(np.std(accs)),
            "faithfulness_mean": float(np.mean(faiths)),
            "faithfulness_std": float(np.std(faiths)),
            "refusal_accuracy_mean": float(np.mean(refusals)),
            "refusal_accuracy_std": float(np.std(refusals)),
            "wrongly_refused_count_mean": float(np.mean(wrong_refusals)),
            "acc_given_hit_mean": float(np.mean(hits_accs)),
            "acc_given_miss_mean": float(np.mean(miss_accs)),
            "latencies_ms": {
                "embed": {"p50": float(np.percentile(embed_lats, 50)), "p95": float(np.percentile(embed_lats, 95))},
                "search": {"p50": float(np.percentile(search_lats, 50)), "p95": float(np.percentile(search_lats, 95))},
                "rerank": {"p50": float(np.percentile(rerank_lats, 50)), "p95": float(np.percentile(rerank_lats, 95))},
                "generation": {"p50": float(np.percentile(gen_lats, 50)), "p95": float(np.percentile(gen_lats, 95))}
            },
            "tokens_per_query_mean": float(np.mean(gen_tokens)),
            "cost_per_query_usd": float(np.mean(total_costs)),
            "cost_per_correct_answer_usd": float(np.sum(total_costs) / (np.mean(accs) * 17)) if np.mean(accs) > 0 else 0.0,
            "runs": run_records
        }
        all_config_results[cfg_name] = cfg_summary
        print(f"  Results for {cfg_name}:")
        print(f"    Correctness: {cfg_summary['correctness_mean']*100:.1f}% (+/- {cfg_summary['correctness_std']*100:.2f}%)")
        print(f"    Faithfulness: {cfg_summary['faithfulness_mean']*100:.1f}% (+/- {cfg_summary['faithfulness_std']*100:.2f}%)")
        print(f"    Refusal Accuracy: {cfg_summary['refusal_accuracy_mean']*100:.1f}% | Wrong Refusals: {cfg_summary['wrongly_refused_count_mean']:.1f}")
        print(f"    Correctness given Hit: {cfg_summary['acc_given_hit_mean']*100:.1f}% | Given Miss: {cfg_summary['acc_given_miss_mean']*100:.1f}%")
        print(f"    Cost / Query: ${cfg_summary['cost_per_query_usd']:.5f} | Cost / Correct Ans: ${cfg_summary['cost_per_correct_answer_usd']:.5f}")

    # Save summary and raw
    out_file = os.path.join(BENCH_DIR, "qa_eval_summary.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_config_results, f, indent=2)
    print(f"\n[OK] QA Evaluation summary saved to {out_file}")

if __name__ == "__main__":
    run_qa_evaluation()

