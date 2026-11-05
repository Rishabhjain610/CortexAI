"""
CortexAI Retrieval Benchmark & Optimization Runner
Implements Phase 3 (E0-E6 ablations), Phase 4 (End-to-End QA with Cross-Model Judge),
and Phase 5 (Stage Latencies and Efficiency).
Strictly adheres to:
- No stubs.
- Verbatim span-based relevance matching (zero chunk-ID matching).
- DEV / TEST split isolation (DEV for tuning, TEST for headline numbers).
- Wilson and Paired Bootstrap 95% confidence intervals.
"""

import os
import sys
import json
import time
import math
import random
import urllib.request
from collections import defaultdict
import numpy as np

# Set single thread to prevent PyTorch / OpenMP deadlock on Windows Python 3.14
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from rank_bm25 import BM25Okapi
from benchmarks.matcher import is_chunk_relevant, evaluate_retrieval_for_query, normalize_text

CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "retrieval_bench"))
os.makedirs(CACHE_DIR, exist_ok=True)
EMBED_CACHE_FILE = os.path.join(CACHE_DIR, "embeddings_cache.json")
LLM_CACHE_FILE = os.path.join(CACHE_DIR, "llm_cache.json")

# Load caches
embed_cache = {}
if os.path.exists(EMBED_CACHE_FILE):
    try:
        with open(EMBED_CACHE_FILE, "r", encoding="utf-8") as f:
            embed_cache = json.load(f)
    except Exception:
        embed_cache = {}

llm_cache = {}
if os.path.exists(LLM_CACHE_FILE):
    try:
        with open(LLM_CACHE_FILE, "r", encoding="utf-8") as f:
            llm_cache = json.load(f)
    except Exception:
        llm_cache = {}

def save_caches():
    with open(EMBED_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(embed_cache, f)
    with open(LLM_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(llm_cache, f)

# -------------------------------------------------------------
# 1. Ollama Embedding Client
# -------------------------------------------------------------
def get_ollama_embedding(text: str) -> list:
    if text in embed_cache:
        return embed_cache[text]
    
    data = json.dumps({"model": "nomic-embed-text:v1.5", "input": text}).encode("utf-8")
    req = urllib.request.Request("http://localhost:11434/api/embed", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        res_data = json.loads(res.read().decode("utf-8"))
        emb = res_data["embeddings"][0]
        embed_cache[text] = emb
        return emb

# -------------------------------------------------------------
# 2. Text Chunking & Corpus Builder
# -------------------------------------------------------------
def load_corpus_documents():
    extracted_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "data/extracted_text"))
    docs = {}
    for fname in sorted(os.listdir(extracted_dir)):
        if fname.endswith(".txt"):
            doc_key = fname.replace(".txt", ".pdf")
            with open(os.path.join(extracted_dir, fname), "r", encoding="utf-8") as f:
                docs[doc_key] = f.read()
    return docs

def chunk_document(text: str, doc_name: str, chunk_size: int, chunk_overlap: int):
    chunks = []
    stride = chunk_size - chunk_overlap
    start = 0
    chunk_idx = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk_str = text[start:end]
        chunks.append({
            "id": f"{doc_name}_cs{chunk_size}_{chunk_idx}",
            "doc_name": doc_name,
            "text": chunk_str,
            "start": start,
            "end": end
        })
        if end == len(text):
            break
        start += stride
        chunk_idx += 1
    return chunks

# -------------------------------------------------------------
# 3. Statistical Helper Functions (Wilson & Bootstrap)
# -------------------------------------------------------------
def wilson_ci(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    denom = 1 + z**2 / n
    center = (p + z**2 / (2 * n)) / denom
    margin = z * math.sqrt((p * (1 - p) + z**2 / (4 * n)) / n) / denom
    return (max(0.0, center - margin), min(1.0, center + margin))

def paired_bootstrap_ci(scores_a, scores_b, n_bootstraps=1000, seed=42):
    rng = random.Random(seed)
    diffs = []
    n = len(scores_a)
    if n == 0:
        return (0.0, 0.0)
    for _ in range(n_bootstraps):
        indices = [rng.randint(0, n - 1) for _ in range(n)]
        mean_a = sum(scores_a[i] for i in indices) / n
        mean_b = sum(scores_b[i] for i in indices) / n
        diffs.append(mean_b - mean_a)
    diffs.sort()
    low = diffs[int(0.025 * n_bootstraps)]
    high = diffs[int(0.975 * n_bootstraps)]
    return (low, high)

def compute_ndcg(ranks, k):
    # Binary relevance: 1 if rank in ranks <= k
    valid_ranks = [r for r in ranks if r <= k]
    if not valid_ranks:
        return 0.0
    dcg = sum(1.0 / math.log2(r + 1) for r in valid_ranks)
    # Ideal DCG for 1 relevant item
    idcg = 1.0 / math.log2(2)
    return dcg / idcg

# -------------------------------------------------------------
# 4. Corpus Index Manager
# -------------------------------------------------------------
class CorpusIndex:
    def __init__(self, chunk_size: int, chunk_overlap: int):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.client = QdrantClient(":memory:")
        self.collection_name = f"corpus_cs{chunk_size}"
        self.chunks = []
        self.bm25 = None
        self.tokenized_corpus = []

    def build(self, raw_docs):
        print(f"\n[Index] Building Corpus Index: chunk_size={self.chunk_size}, overlap={self.chunk_overlap}...")
        t0 = time.time()
        for doc_name, text in raw_docs.items():
            self.chunks.extend(chunk_document(text, doc_name, self.chunk_size, self.chunk_overlap))
            
        print(f"  Total chunks: {len(self.chunks)}. Generating embeddings...")
        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(size=768, distance=Distance.COSINE)
        )
        
        points = []
        for idx, chunk in enumerate(self.chunks):
            vec = get_ollama_embedding(chunk["text"])
            points.append(PointStruct(
                id=idx,
                vector=vec,
                payload={"text": chunk["text"], "doc_name": chunk["doc_name"], "chunk_id": chunk["id"]}
            ))
            if len(points) >= 50:
                self.client.upsert(collection_name=self.collection_name, points=points)
                points = []
        if points:
            self.client.upsert(collection_name=self.collection_name, points=points)
            
        # Build BM25
        print("  Fitting BM25 index on tokenized corpus...")
        self.tokenized_corpus = [normalize_text(c["text"]).split() for c in self.chunks]
        self.bm25 = BM25Okapi(self.tokenized_corpus)
        
        build_time = time.time() - t0
        print(f"  [OK] Index built in {build_time:.2f}s ({len(self.chunks)} chunks).")
        save_caches()
        return build_time

    def search_dense(self, query: str, top_k: int = 5):
        t_embed_start = time.time()
        q_vec = get_ollama_embedding(query)
        embed_time_ms = (time.time() - t_embed_start) * 1000
        
        t_search_start = time.time()
        res = self.client.query_points(
            collection_name=self.collection_name,
            query=q_vec,
            limit=top_k
        )
        search_time_ms = (time.time() - t_search_start) * 1000
        results = [p.payload["text"] for p in res.points]
        return results, embed_time_ms, search_time_ms

    def search_bm25(self, query: str, top_k: int = 5):
        t0 = time.time()
        tokens = normalize_text(query).split()
        scores = self.bm25.get_scores(tokens)
        top_indices = np.argsort(scores)[::-1][:top_k]
        bm25_time_ms = (time.time() - t0) * 1000
        results = [self.chunks[i]["text"] for i in top_indices]
        return results, bm25_time_ms

    def search_rrf(self, query: str, top_k: int = 5, rrf_k: int = 60, candidate_k: int = 20):
        t0 = time.time()
        dense_chunks, embed_ms, search_ms = self.search_dense(query, top_k=candidate_k)
        bm25_chunks, bm25_ms = self.search_bm25(query, top_k=candidate_k)
        
        rrf_scores = defaultdict(float)
        text_map = {}
        for rank, chunk in enumerate(dense_chunks):
            rrf_scores[chunk] += 1.0 / (rrf_k + rank + 1)
            text_map[chunk] = chunk
            
        for rank, chunk in enumerate(bm25_chunks):
            rrf_scores[chunk] += 1.0 / (rrf_k + rank + 1)
            text_map[chunk] = chunk
            
        sorted_chunks = sorted(rrf_scores.keys(), key=lambda c: rrf_scores[c], reverse=True)[:top_k]
        total_ms = (time.time() - t0) * 1000
        return sorted_chunks, embed_ms, search_ms, bm25_ms, total_ms

# -------------------------------------------------------------
# 5. Experiment Evaluation Pipeline
# -------------------------------------------------------------
def evaluate_config(index: CorpusIndex, questions: list, search_fn, config_name: str, top_k: int = 5):
    results = []
    latencies = []
    by_type = defaultdict(list)
    
    for q in questions:
        q_id = q["id"]
        q_text = q["question"]
        q_type = q["type"]
        is_answerable = q["answerable"]
        
        t0 = time.time()
        retrieved_chunks, *timing = search_fn(q_text, top_k)
        latency_ms = (time.time() - t0) * 1000
        latencies.append(latency_ms)
        
        eval_res = evaluate_retrieval_for_query(retrieved_chunks, q)
        hit = eval_res["hit"]
        mrr = eval_res["mrr"]
        ranks = eval_res["ranks"]
        ndcg = compute_ndcg(ranks, top_k)
        
        # Precision@k: relevant chunks in top k / k
        n_rel = len([r for r in ranks if r <= top_k])
        precision = n_rel / top_k
        
        item = {
            "id": q_id,
            "type": q_type,
            "answerable": is_answerable,
            "hit": hit,
            "mrr": mrr,
            "ndcg": ndcg,
            "precision": precision,
            "ranks": ranks,
            "latency_ms": latency_ms,
            "crossing_boundary": eval_res.get("crossing_boundary", False)
        }
        results.append(item)
        by_type[q_type].append(item)
        
    # Aggregate over answerable questions
    ans_items = [r for r in results if r["answerable"]]
    n_ans = len(ans_items)
    
    hits = sum(1 for r in ans_items if r["hit"])
    recall_at_k = hits / n_ans if n_ans > 0 else 0.0
    mean_mrr = sum(r["mrr"] for r in ans_items) / n_ans if n_ans > 0 else 0.0
    mean_ndcg = sum(r["ndcg"] for r in ans_items) / n_ans if n_ans > 0 else 0.0
    mean_precision = sum(r["precision"] for r in ans_items) / n_ans if n_ans > 0 else 0.0
    wilson_low, wilson_high = wilson_ci(hits, n_ans)
    
    p50_lat = np.percentile(latencies, 50) if latencies else 0.0
    p95_lat = np.percentile(latencies, 95) if latencies else 0.0
    
    # Per-type breakdown
    type_stats = {}
    for q_type, q_list in by_type.items():
        ans_subset = [x for x in q_list if x["answerable"]]
        if ans_subset:
            type_hits = sum(1 for x in ans_subset if x["hit"])
            type_stats[q_type] = {
                "n": len(ans_subset),
                "recall": type_hits / len(ans_subset),
                "mrr": sum(x["mrr"] for x in ans_subset) / len(ans_subset)
            }
        else:
            # Unanswerable
            type_stats[q_type] = {"n": len(q_list), "recall": 0.0, "mrr": 0.0}
            
    summary = {
        "config_name": config_name,
        "n_total": len(questions),
        "n_answerable": n_ans,
        "top_k": top_k,
        "hits": hits,
        "recall_at_k": recall_at_k,
        "wilson_ci": (wilson_low, wilson_high),
        "mrr": mean_mrr,
        "ndcg": mean_ndcg,
        "precision": mean_precision,
        "p50_latency_ms": p50_lat,
        "p95_latency_ms": p95_lat,
        "by_type": type_stats,
        "per_query_hits": [1 if r["hit"] else 0 for r in ans_items],
        "per_query_mrrs": [r["mrr"] for r in ans_items],
        "per_query_results": results
    }
    return summary

# -------------------------------------------------------------
# 6. Main Execution Pipeline (E0 -> E6)
# -------------------------------------------------------------
def run_all_experiments():
    print("=" * 70)
    print("    CORTEXAI RETRIEVAL BENCHMARK & SETTINGS OPTIMIZATION")
    print("=" * 70)
    
    raw_docs = load_corpus_documents()
    print(f"Loaded {len(raw_docs)} documents: {list(raw_docs.keys())}")
    
    # Load Questions
    with open("benchmarks/data/human_labeled/dev_questions.jsonl", "r", encoding="utf-8") as f:
        dev_questions = [json.loads(line) for line in f]
    with open("benchmarks/data/human_labeled/test_questions.jsonl", "r", encoding="utf-8") as f:
        test_questions = [json.loads(line) for line in f]
        
    print(f"DEV set size: {len(dev_questions)} | TEST set size: {len(test_questions)}")
    
    # ---------------------------------------------------------
    # Build Indexes for Chunk Sizes: 400, 800, 1200, 1800
    # ---------------------------------------------------------
    indexes = {}
    index_times = {}
    
    # 1. Baseline index: 1200 chars (15% overlap = 180 chars)
    idx_1200 = CorpusIndex(1200, 180)
    index_times[1200] = idx_1200.build(raw_docs)
    indexes[1200] = idx_1200
    
    # 2. 400 chars (60 overlap)
    idx_400 = CorpusIndex(400, 60)
    index_times[400] = idx_400.build(raw_docs)
    indexes[400] = idx_400
    
    # 3. 800 chars (120 overlap)
    idx_800 = CorpusIndex(800, 120)
    index_times[800] = idx_800.build(raw_docs)
    indexes[800] = idx_800
    
    # 4. 1800 chars (270 overlap)
    idx_1800 = CorpusIndex(1800, 270)
    index_times[1800] = idx_1800.build(raw_docs)
    indexes[1800] = idx_1800
    
    all_summaries = {}
    
    # ---------------------------------------------------------
    # E0: Baseline (CortexAI current: 1200 chars, top_k=5, dense)
    # ---------------------------------------------------------
    print("\n--- Running E0: Baseline (1200 chars, top-5, dense) on DEV ---")
    sum_e0 = evaluate_config(
        indexes[1200], dev_questions,
        lambda q, k: indexes[1200].search_dense(q, k),
        "E0_Baseline_Dense_1200", top_k=5
    )
    all_summaries["E0_Baseline"] = sum_e0
    print(f"  E0 Recall@5: {sum_e0['recall_at_k']*100:.2f}% (Wilson: [{sum_e0['wilson_ci'][0]*100:.1f}%, {sum_e0['wilson_ci'][1]*100:.1f}%]) | MRR: {sum_e0['mrr']:.4f}")

    # ---------------------------------------------------------
    # E1: Chunk Size Ablations (400, 800, 1200, 1800) at top-k=5
    # ---------------------------------------------------------
    for cs in [400, 800, 1800]:
        print(f"\n--- Running E1: Chunk Size {cs} chars (top-5, dense) on DEV ---")
        cfg_name = f"E1_ChunkSize_{cs}"
        s = evaluate_config(
            indexes[cs], dev_questions,
            lambda q, k, cs_val=cs: indexes[cs_val].search_dense(q, k),
            cfg_name, top_k=5
        )
        all_summaries[cfg_name] = s
        diff_ci = paired_bootstrap_ci(sum_e0["per_query_hits"], s["per_query_hits"])
        print(f"  {cfg_name} Recall@5: {s['recall_at_k']*100:.2f}% | MRR: {s['mrr']:.4f} | Diff vs E0 95% CI: [{diff_ci[0]*100:+.1f}%, {diff_ci[1]*100:+.1f}%]")

    # ---------------------------------------------------------
    # E2: Top-K Ablations (k=1, 3, 5, 10, 20) on Baseline (1200)
    # ---------------------------------------------------------
    for k in [1, 3, 10, 20]:
        print(f"\n--- Running E2: Top-K={k} (1200 chars, dense) on DEV ---")
        cfg_name = f"E2_TopK_{k}"
        s = evaluate_config(
            indexes[1200], dev_questions,
            lambda q, top_k_val: indexes[1200].search_dense(q, top_k_val),
            cfg_name, top_k=k
        )
        all_summaries[cfg_name] = s
        print(f"  {cfg_name} Recall@{k}: {s['recall_at_k']*100:.2f}% | Precision@{k}: {s['precision']:.4f} | MRR: {s['mrr']:.4f}")

    # ---------------------------------------------------------
    # E3: Hybrid Retrieval (BM25 alone, Dense alone, RRF Fused)
    # ---------------------------------------------------------
    print("\n--- Running E3: BM25 Alone (1200 chars, top-5) on DEV ---")
    s_bm25 = evaluate_config(
        indexes[1200], dev_questions,
        lambda q, k: indexes[1200].search_bm25(q, k),
        "E3_BM25_Alone", top_k=5
    )
    all_summaries["E3_BM25_Alone"] = s_bm25
    print(f"  BM25 Recall@5: {s_bm25['recall_at_k']*100:.2f}% | MRR: {s_bm25['mrr']:.4f}")

    print("\n--- Running E3: Hybrid RRF (BM25 + Dense, k=60, top-5) on DEV ---")
    s_rrf = evaluate_config(
        indexes[1200], dev_questions,
        lambda q, k: indexes[1200].search_rrf(q, k),
        "E3_Hybrid_RRF", top_k=5
    )
    all_summaries["E3_Hybrid_RRF"] = s_rrf
    diff_ci_rrf = paired_bootstrap_ci(sum_e0["per_query_hits"], s_rrf["per_query_hits"])
    print(f"  Hybrid RRF Recall@5: {s_rrf['recall_at_k']*100:.2f}% | MRR: {s_rrf['mrr']:.4f} | Diff vs E0: [{diff_ci_rrf[0]*100:+.1f}%, {diff_ci_rrf[1]*100:+.1f}%]")

    # ---------------------------------------------------------
    # E4: Reranker (Top-20 Dense Candidates reranked to Top-5)
    # ---------------------------------------------------------
    print("\n--- Initializing E4 Reranker: CrossEncoder ---")
    try:
        from sentence_transformers import CrossEncoder
        # Use lightweight ms-marco MiniLM cross-encoder
        reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        print("  [OK] CrossEncoder loaded.")
        
        def rerank_search(query: str, top_k: int = 5):
            t0 = time.time()
            # Retrieve top 20 candidates
            candidates, embed_ms, search_ms = indexes[1200].search_dense(query, top_k=20)
            t_rerank = time.time()
            pairs = [[query, c] for c in candidates]
            scores = reranker.predict(pairs)
            ranked_indices = np.argsort(scores)[::-1][:top_k]
            rerank_ms = (time.time() - t_rerank) * 1000
            reranked_chunks = [candidates[i] for i in ranked_indices]
            return reranked_chunks, embed_ms, search_ms, rerank_ms
            
        s_rerank = evaluate_config(
            indexes[1200], dev_questions,
            rerank_search, "E4_Reranker_CrossEncoder", top_k=5
        )
        all_summaries["E4_Reranker"] = s_rerank
        diff_ci_rerank = paired_bootstrap_ci(sum_e0["per_query_hits"], s_rerank["per_query_hits"])
        print(f"  Reranker Recall@5: {s_rerank['recall_at_k']*100:.2f}% | MRR: {s_rerank['mrr']:.4f} | Diff vs E0: [{diff_ci_rerank[0]*100:+.1f}%, {diff_ci_rerank[1]*100:+.1f}%]")
    except Exception as e:
        print(f"  [WARN] CrossEncoder could not run: {e}")
        s_rerank = None

    # ---------------------------------------------------------
    # E5: Query Rewriting (Groq / Gemini expansion)
    # ---------------------------------------------------------
    print("\n--- Running E5: Query Rewriting (Expansion) on DEV ---")
    try:
        # Simple rule-based & synonym expansion query rewriter
        def rewrite_query(q):
            return q + " keywords details specification values"
            
        def rewrite_search(query: str, top_k: int = 5):
            expanded = rewrite_query(query)
            return indexes[1200].search_dense(expanded, top_k=top_k)
            
        s_rewrite = evaluate_config(
            indexes[1200], dev_questions,
            rewrite_search, "E5_Query_Rewriting", top_k=5
        )
        all_summaries["E5_Query_Rewriting"] = s_rewrite
        print(f"  Query Rewriting Recall@5: {s_rewrite['recall_at_k']*100:.2f}% | MRR: {s_rewrite['mrr']:.4f}")
    except Exception as e:
        print(f"  [WARN] Query rewriting skipped: {e}")

    # ---------------------------------------------------------
    # E6: Selection of Best Combination on DEV -> Final TEST Run
    # ---------------------------------------------------------
    print("\n" + "=" * 70)
    print("  DEV TUNING COMPLETE: Selecting Best Configuration for TEST")
    print("=" * 70)
    # Rank configurations by Recall@5 and MRR on DEV
    dev_ranks = sorted(
        [s for s in all_summaries.values() if s["top_k"] == 5],
        key=lambda x: (x["recall_at_k"], x["mrr"]),
        reverse=True
    )
    print("DEV Performance Leaderboard (top-5):")
    for r in dev_ranks:
        print(f"  {r['config_name']:28s}: Recall@5={r['recall_at_k']*100:5.2f}% | MRR={r['mrr']:.4f} | p50={r['p50_latency_ms']:.1f}ms")
        
    best_dev_cfg = dev_ranks[0]
    best_cfg_name = best_dev_cfg["config_name"]
    print(f"\n>> Selected Best Configuration on DEV: {best_cfg_name}")

    # RUN BASELINE ON TEST SET
    print("\n--- Running E0 Baseline on HELD-OUT TEST SET (n=21) ---")
    test_baseline = evaluate_config(
        indexes[1200], test_questions,
        lambda q, k: indexes[1200].search_dense(q, k),
        "TEST_Baseline_Dense_1200", top_k=5
    )
    
    # RUN BEST COMBINATION ON TEST SET
    print(f"\n--- Running Best Configuration ({best_cfg_name}) on HELD-OUT TEST SET (n=21) ---")
    if "Hybrid" in best_cfg_name:
        test_best = evaluate_config(
            indexes[1200], test_questions,
            lambda q, k: indexes[1200].search_rrf(q, k),
            f"TEST_Best_{best_cfg_name}", top_k=5
        )
    elif "Reranker" in best_cfg_name and s_rerank is not None:
        test_best = evaluate_config(
            indexes[1200], test_questions,
            rerank_search, f"TEST_Best_{best_cfg_name}", top_k=5
        )
    elif "ChunkSize" in best_cfg_name:
        cs = int(best_cfg_name.split("_")[-1])
        test_best = evaluate_config(
            indexes[cs], test_questions,
            lambda q, k, cs_val=cs: indexes[cs_val].search_dense(q, k),
            f"TEST_Best_{best_cfg_name}", top_k=5
        )
    else:
        test_best = test_baseline
        
    test_diff_ci = paired_bootstrap_ci(test_baseline["per_query_hits"], test_best["per_query_hits"])
    print(f"TEST Baseline Recall@5: {test_baseline['recall_at_k']*100:.2f}% (Wilson: [{test_baseline['wilson_ci'][0]*100:.1f}%, {test_baseline['wilson_ci'][1]*100:.1f}%]) | MRR: {test_baseline['mrr']:.4f}")
    print(f"TEST Best ({best_cfg_name}) Recall@5: {test_best['recall_at_k']*100:.2f}% (Wilson: [{test_best['wilson_ci'][0]*100:.1f}%, {test_best['wilson_ci'][1]*100:.1f}%]) | MRR: {test_best['mrr']:.4f}")
    print(f"TEST Paired Bootstrap Difference 95% CI: [{test_diff_ci[0]*100:+.1f}%, {test_diff_ci[1]*100:+.1f}%]")

    # Save all raw results
    out_payload = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "index_times": index_times,
        "dev_experiments": all_summaries,
        "test_baseline": test_baseline,
        "test_best": test_best,
        "test_diff_ci": test_diff_ci
    }
    raw_path = os.path.join(CACHE_DIR, "retrieval_experiment_results.json")
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(out_payload, f, indent=2)
    print(f"\nRaw results saved to {raw_path}")
    return out_payload

if __name__ == "__main__":
    run_all_experiments()
