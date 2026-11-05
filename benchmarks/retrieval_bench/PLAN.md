# CortexAI Retrieval Benchmark & Settings Optimization Plan

**Target Branch:** `bench-retrieval`  
**Date:** November 4, 2026  
**Budget Hard Cap:** $5.00 USD  
**Estimated Benchmark Cost:** ~$0.15 USD  

---

## 1. Corpus Architecture & Chunking Parameters

The evaluation uses a corpus of **4 real, heterogeneous technical PDF documents** totaling **468,644 raw characters** (over 120 pages total) located in `benchmarks/data/real_docs/`:

1. **`doc1_healthcare_review.pdf`** (194,702 chars, ~40 pages): Peer-reviewed systematic literature review on AI-blockchain electronic health records (IEEE format).
2. **`doc2_uba_sanctioned_projects.pdf`** (169,927 chars, ~50 pages): Government project sanction ledger (Unnat Bharat Abhiyan) containing hundreds of rows with institutional codes, PI coordinators, project titles, SEGs, and sanctioned funding.
3. **`doc3_academic_curriculum_brochure.pdf`** (65,828 chars, ~30 pages): Institutional admission brochure with Principal's address (Agentic AI, Mobile Robotics), department programs, and career pathways.
4. **`doc4_nlp_lab_project_report.pdf`** (38,187 chars, ~15 pages): NLP engineering laboratory report with statistical vs transformer classifiers (DistilBERT vs Logistic Regression, NLTK, WordNet, weighted F1).

### Corpus Size per Chunking Setting (15% Overlap)
- **400 chars (60-char overlap):** 1,380 chunks
- **800 chars (120-char overlap):** 690 chunks
- **1,200 chars (180-char overlap, baseline):** 461 chunks
- **1,800 chars (270-char overlap):** 307 chunks

*All configurations exceed the minimum threshold of 300 chunks.*

---

## 2. Question Dataset & Stratified Split

- **Dataset File:** `benchmarks/data/human_labeled/rag_questions.jsonl`
- **Total Questions:** 42 human-labeled items
- **Ground Truth Validation:** Every answerable question has an `answer_span` validated verbatim against the extracted raw corpus text (`assert norm_span in norm_doc`).
- **50/50 Stratified Split (`seed=42`):**
  - **DEV Set (`dev_questions.jsonl`):** 21 questions (used strictly for tuning E1–E5)
  - **TEST Set (`test_questions.jsonl`):** 21 questions (held out for final evaluation)

| Question Category | Total Count | DEV Set ($n=21$) | TEST Set ($n=21$) | Matcher Rule |
| :--- | :---: | :---: | :---: | :--- |
| **Direct** | 15 | 8 | 7 | Exact span in retrieved chunk |
| **Paraphrased** | 10 | 5 | 5 | Exact span in retrieved chunk (non-overlapping question wording) |
| **Multi-Hop** | 5 | 3 | 2 | Requires multiple spans / boundary crossing check |
| **Table-Based** | 5 | 2 | 3 | Table cell values / numbers in row context |
| **Unanswerable** | 7 | 3 | 4 | Ground truth refusal (`answerable: false`) |

---

## 3. Span Matcher & Unit Tests

- Implemented in `benchmarks/matcher.py`.
- **Zero reliance on chunk IDs:** Matching strictly checks normalized substring presence.
- **Boundary-Crossing Support:** If text splitting divides a span across chunk boundaries, chunks containing the boundary prefix or suffix (min 25 characters) are credited as relevant.
- **Unit Test Suite:** Passed 7 unit tests in `benchmarks/test_matcher.py` (exact, case-insensitive, whitespace/newlines, boundary splits, non-matches, and unanswerables).

---

## 4. Preflight Guard & Zero-Stub Verification

- Validated via `benchmarks/preflight.py`:
  - `LLM_STUB_MODE = 0` (zero stubs).
  - Ollama running with `nomic-embed-text:v1.5` (digest `0a109f422b47...`, 768 dimensions).
  - Embedding sanity check: Paraphrase pairs cosine similarity = **0.7916**, Unrelated pairs cosine similarity = **0.3632** (delta = **+0.4283**).
  - Qdrant running on `:6333`.
  - Gemini Flash API key and Groq API key loaded and active.

---

## 5. Experiment Matrix (Phase 3)

Change ONE factor at a time against the baseline (DEV set):
- **E0 (Baseline):** Current CortexAI settings (1,200 char chunk size, 250 overlap, top-k=5, dense Ollama nomic embedding).
- **E1 (Chunk Size):** 400, 800, 1,200, 1,800 chars (15% overlap).
- **E2 (Top-K):** k = 1, 3, 5, 10, 20.
- **E3 (Hybrid Retrieval):** Dense + BM25 with Reciprocal Rank Fusion ($k=60$). Also report BM25 alone and dense alone.
- **E4 (Reranker):** Cross-encoder scoring on top-20 candidates, keeping top-5.
- **E5 (Query Rewriting):** LLM expansion before retrieval.
- **E6 (Best Combination):** Selected on DEV, evaluated once on held-out TEST set.

---

## 6. Budget & Cost Plan

- **Local Infrastructure (Embeddings & Qdrant):** $0.00
- **Phase 3 Retrieval Ablations:** $0.00 (span matching executed locally via Python)
- **Phase 4 Answer Generation & Cross-Model Judging:**
  - 3 configurations $\times$ 3 runs $\times$ 21 questions = 189 generator calls (`gemini-3.1-flash-lite`) $\approx$ 310k tokens $\approx$ **$0.04 USD**
  - 189 judging calls (`qwen/qwen3.8-27b` via Groq) $\approx$ 340k tokens $\approx$ **$0.05 USD**
- **Total Estimated Cost:** **~$0.15 USD** (hard cap: $5.00 USD).
- **Caching:** Keyed by `(model, prompt, temperature)` in `benchmarks/retrieval_bench/cache.json`.

