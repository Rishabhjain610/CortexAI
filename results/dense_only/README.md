# CortexAI Dense-Only RAG Evaluation

Reproducible benchmark evaluating **ONLY dense vector similarity search** on the CortexAI corpus.
Strictly **zero reranking**, **zero BM25**, and **zero hybrid fusion**.

## 1. Experimental Setup & Environment

- **Embedding Model**: Ollama `nomic-embed-text:v1.5` (768-dimensional dense vectors)
- **Vector Store**: Qdrant (`qdrant-client` v1.20.0, in-memory collection per configuration, Cosine Distance)
- **Text Splitter**: LangChain `RecursiveCharacterTextSplitter` (`langchain_text_splitters` v1.1.3)
- **Corpus**: 4 documents in `benchmark/corpus` (468,644 total characters, clean document body texts)
- **Evaluation Splits**:
  - **DEV Set**: `benchmark/qa_dev.jsonl` (21 questions: 18 answerable, 3 unanswerable) used **strictly for hyperparameter tuning**.
  - **TEST Set**: `benchmark/qa_test.jsonl` (21 questions: 17 answerable, 4 unanswerable) held-out until chosen config evaluation.
- **Generator**: Google Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite`, temperature 0.2, 3 independent runs)
- **Judge**: Groq `openai/gpt-oss-120b` (temperature 0, independent judge family)
- **Random Seed**: `42`
- **Python Version**: `3.14.9`

## 2. Sample Sizes & Matching Rules

- **Corpus Chars**: 468,644 characters across 4 PDFs.
- **DEV Split**: 21 queries (18 answerable, 3 unanswerable).
- **TEST Split**: 21 queries (17 answerable, 4 unanswerable).
- **Matching Rule**: A retrieved chunk is deemed relevant (`hit = True`) **only if it contains the verbatim ground-truth span from the QA file (normalized whitespace only)**.
- **Chunk ID Matching**: **Zero**. Matching is performed solely on chunk text content.

## 3. Metric Computation Definitions

- **Recall@k**: Fraction of answerable queries where at least one retrieved chunk in top-k contains the verbatim ground-truth span ($hits / |Q_{ans}|$).
- **Wilson 95% Confidence Interval**: Exact binomial confidence interval for Recall@k using $z = 1.96$.
- **MRR (Mean Reciprocal Rank)**: $\frac{1}{|Q_{ans}|} \sum_{q} \frac{1}{rank_q}$, where $rank_q$ is the 1-based index of the first hit ($0$ if no hit in top-k).
- **nDCG@k**: Discounted Cumulative Gain normalized by Ideal DCG ($1 / \log_2(2) = 1.0$) for binary single-span relevance.
- **Precision@k**: $\frac{1}{|Q_{ans}|} \sum_{q} \frac{\text{hits in top-}k}{k}$.
- **p50 & p95 Latencies**: Median and 95th-percentile execution times measured separately for query embedding and Qdrant index search.
- **End-to-End Metrics** (across 3 runs):
  - **Answer Correctness**: Judge score indicating semantic agreement with ground-truth.
  - **Faithfulness**: Judge score indicating zero hallucinated facts outside retrieved context.
  - **Refusal Accuracy on Unanswerables**: Percentage of unanswerable questions correctly refused.
  - **Wrong Refusals on Answerables**: Percentage of answerable questions incorrectly refused.

## 4. DEV Tuning Results (D1 Candidate Depth & D2 Chunk Size)

| Configuration | Chunk Size | Overlap | Top-K | Recall@k | Wilson 95% CI | MRR | nDCG@k | Prec@k | Embed p50 (ms) | Search p50 (ms) | Total p50 (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **D1_top1** | 1200 | 250 | 1 | 16.67% | [5.8%, 39.2%] | 0.1667 | 0.1667 | 0.1667 | 104.69 | 5.34 | 110.41 |
| **D1_top3** | 1200 | 250 | 3 | 27.78% | [12.5%, 50.9%] | 0.2222 | 0.2368 | 0.0926 | 75.30 | 4.39 | 79.51 |
| **D1_top5** | 1200 | 250 | 5 | 44.44% | [24.6%, 66.3%] | 0.2556 | 0.3012 | 0.0889 | 74.03 | 4.54 | 78.87 |
| **D1_top10** | 1200 | 250 | 10 | 72.22% | [49.1%, 87.5%] | 0.2901 | 0.3886 | 0.0722 | 88.60 | 4.95 | 92.78 |
| **D1_top20** | 1200 | 250 | 20 | 77.78% | [54.8%, 91.0%] | 0.2947 | 0.4036 | 0.0389 | 80.28 | 4.90 | 85.07 |
| **D2_cs400_top5** | 400 | 83 | 5 | 61.11% | [38.6%, 79.7%] | 0.5139 | 0.5624 | 0.1333 | 82.66 | 9.93 | 92.01 |
| **D2_cs800_top5** | 800 | 167 | 5 | 44.44% | [24.6%, 66.3%] | 0.2167 | 0.2721 | 0.0889 | 75.38 | 5.67 | 81.10 |
| **D2_cs1200_top5** | 1200 | 250 | 5 | 44.44% | [24.6%, 66.3%] | 0.2556 | 0.3012 | 0.0889 | 88.36 | 4.78 | 93.76 |
| **D2_cs1800_top5** | 1800 | 375 | 5 | 22.22% | [9.0%, 45.2%] | 0.0991 | 0.1288 | 0.0444 | 80.34 | 4.08 | 84.79 |

## 5. Chosen Configuration & Held-Out TEST Evaluation

Based on DEV tuning, configuration **`Chosen_Dense_cs400_top5`** (chunk_size=400, overlap=83, top-k=5) achieved the highest Recall@5 (61.11%) and MRR (0.5139) on DEV and was selected for final held-out TEST evaluation.

### Retrieval Performance on Held-Out TEST Set

| Metric | TEST Value |
|---|---|
| **Recall@5** | **29.41%** |
| **Wilson 95% CI** | **[13.3%, 53.1%]** |
| **MRR** | **0.2353** |
| **nDCG@5** | **0.2507** |
| **Precision@5** | **0.0588** |
| **Query Embedding p50 / p95** | 98.14 ms / 123.45 ms |
| **Qdrant Search p50 / p95** | 11.96 ms / 13.93 ms |
| **Total Retrieval Latency p50 / p95** | **110.77 ms / 136.11 ms** |

### End-to-End QA Performance on TEST Set (3 Runs)

| Metric | Run 1 | Run 2 | Run 3 | Mean ± Std |
|---|---|---|---|---|
| **Answer Correctness (Overall)** | 61.9% | 61.9% | 61.9% | **61.9% ± 0.0%** |
| **Answer Correctness (Answerables)** | 52.9% | 52.9% | 52.9% | **52.9% ± 0.0%** |
| **Faithfulness** | 100.0% | 95.2% | 95.2% | **96.8% ± 2.2%** |
| **Refusal Accuracy (Unanswerables)** | 100.0% | 100.0% | 100.0% | **100.0% ± 0.0%** |
| **Wrong Refusals (Answerables)** | 47.1% | 47.1% | 47.1% | **47.1% ± 0.0%** |

## 6. Execution Status & Auditing Log

- **Failed Runs**: 0 (all queries and runs completed successfully without error)
- **Skipped Runs**: 0
- **Raw Artifacts**:
  - `results/dense_only/leaderboard.csv`
  - `results/dense_only/e2e_summary.json`
  - `results/dense_only/embed_cache.json`
