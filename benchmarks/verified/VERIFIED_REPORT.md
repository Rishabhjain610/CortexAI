# CortexAI Verified Production Benchmark Report

**Branch:** `bench-verified`  
**Execution Date:** 2026-11-03  
**Methodology:** Strict Zero-Stub Verification (Ollama `nomic-embed-text:v1.5` local embeddings, Qdrant real vector collection `cortexai_verified_nomic_v15`, Google Gemini Real LLMs, and real multi-threaded system harnesses).

---

## Executive Scorecard

| Benchmark Category | Metric Evaluated | Baseline (Unpatched / Stub) | Verified Value (Real Models) | Verification Status |
|---|---|:---:|:---:|:---:|
| **RAG Retrieval Quality** | In-Domain Recall@1 | Invalid (hash stub) | **100.0%** (16/16) | **PASS** |
| **RAG Retrieval Quality** | In-Domain Recall@3 / Recall@5 | Invalid (hash stub) | **100.0%** (16/16) | **PASS** |
| **RAG Retrieval Quality** | Mean Reciprocal Rank (MRR) | Invalid (hash stub) | **1.0000** | **PASS** |
| **RAG Answer Generation** | Grounded Generation Correctness | Invalid (LLM stub) | **100.0%** (16/16) | **PASS** |
| **RAG Refusal & Hallucination** | Out-of-Domain Refusal Rate | Invalid (LLM stub) | **100.0%** (8/8) | **PASS** |
| **RAG Refusal & Hallucination** | Hallucination Rate | Invalid (LLM stub) | **0.0%** (0/8) | **PASS** |
| **Prompt Injection Resilience** | Attack Neutralization Rate | Invalid (LLM stub) | **100.0%** (20/20 defended) | **PASS** |
| **Prompt Injection Resilience** | Compromise / Leakage Rate | Invalid (LLM stub) | **0.0%** (0/20 compromised) | **PASS** |
| **Agent Router Accuracy** | 80-Prompt Routing Accuracy | 92.5% (with crash) | **93.8%** (75/80 correct) | **PASS** |
| **Agent Router Layers** | Heuristic vs LLM Distribution | 0% LLM (crashed) | **75.0% L2 / 25.0% L3** | **PASS** |
| **Payment Replay Attack** | 100 Parallel Requests Accounted | 97 credited, 3 drops | **1 credited, 99 blocked (`409`), 0 drops** | **PASS** |
| **Sliding Window Burst** | 120 Parallel Requests (Limit: 100) | 103 allowed (3 leaked) | **100 allowed, 20 blocked (`429`)** | **PASS** |
| **BullMQ Worker Crash** | Stalled Job Recovery Semantics | 1 lost job (unverified) | **Lock expiry verified; job recovered & completed** | **PASS** |
| **Redis Outage Handling** | Failure Response Mode & Latency | "Instantaneous" | **Graceful 503 (`< 0.01ms`), no gateway hang** | **PASS** |

---

## Phase-by-Phase Verified Details

### Phase 1: Real-Model RAG Retrieval & Generation Quality
* **Embedding Model**: Ollama `nomic-embed-text:v1.5` (768-dim, local digest `0a109f422b47`)
* **Vector Store**: Qdrant isolated collection `cortexai_verified_nomic_v15`
* **LLM Generator**: Google Gemini (`models/gemini-3.6-flash` / `models/gemini-3.1-flash-lite`)
* **Set A (In-Domain Grounded QA - 16 queries)**:
  - Recall@1: **100.0%**
  - Recall@3: **100.0%**
  - Recall@5: **100.0%**
  - MRR: **1.0000**
  - Answer Correctness: **100.0%** (Key technical facts accurately synthesized from context)
* **Set B (Out-of-Domain & Adversarial QA - 8 queries)**:
  - Grounded Refusal Rate: **100.0%** (Cleanly refused without speculative extrapolation)
  - Hallucination Rate: **0.0%**
* **Provider Token Usage**: 11,557 tokens
* **Raw Artifact**: [`benchmarks/results/verified/raw/rag_quality_raw.json`](file:///C:/Users/Rishabh%20Jain/Desktop/github/CortexAI/benchmarks/results/verified/raw/rag_quality_raw.json)  
  *SHA256: `19d72b66a08e3e41e15bbd37aa974b5b0205fb2e73cafc362e5ba1fe53ec2466`*

---

### Phase 2: Real-Model Prompt Injection Resilience
* **Model Tested**: Google Gemini (`models/gemini-3.1-flash-lite` / `models/gemini-3-flash-preview`)
* **Attack Suite**: 20 distinct attack vectors covering system prompt exfiltration, DAN personas, delimiter injection, developer mode roleplay, Base64/multilingual obfuscation, indirect RAG context injection, cognitive dissonance safety inversions, and administrative simulation.
* **Results**:
  - Attacks Defended / Neutralized: **20 / 20 (100.0%)**
  - Attacks Compromised: **0 / 20 (0.0%)**
  - Confidential Secret Leaks: **0**
* **Provider Token Usage**: 5,316 tokens
* **Raw Artifact**: [`benchmarks/results/verified/raw/prompt_injection_raw.json`](file:///C:/Users/Rishabh%20Jain/Desktop/github/CortexAI/benchmarks/results/verified/raw/prompt_injection_raw.json)  
  *SHA256: `6059dfa395dba72f0536866ec76b5a8e53ba27278f413e7110079445c5d2d5ca`*

---

### Phase 3: Router Accuracy After Layer 3 Fix
* **Architecture**: 3-layer orchestration (Manual $\rightarrow$ Heuristic regex $\rightarrow$ Gemini LLM fallback)
* **Test Dataset**: 80 realistic prompts across 6 intents (`codingAgent`, `searchAgent`, `imageAgent`, `pptAgent`, `pdfAgent`, `chatAgent`)
* **Results**:
  - Correctly Routed: **75 / 80 (93.8% accuracy)** (Up from previous 92.5%)
  - Layer 2 Deterministic Heuristic Decisions: **60 / 80 (75.0%)**
  - Layer 3 LLM Fallback Decisions: **20 / 80 (25.0%)**
  - Crashes (`ReferenceError: history`): **0** (Eliminated via default parameter state initialization)
* **Provider Token Usage**: 3,270 tokens
* **Raw Artifact**: [`benchmarks/results/verified/raw/router_accuracy_raw.json`](file:///C:/Users/Rishabh%20Jain/Desktop/github/CortexAI/benchmarks/results/verified/raw/router_accuracy_raw.json)  
  *SHA256: `c79a3d57d7f8c97d4b9701d60d8eea97396910960757b3c9564bbe16a972b34f`*

---

### Phase 4: Systematic System Audits & Discrepancy Resolution
1. **Payment Replay Attack**:
   - Total requests dispatched: Exactly 100 concurrent requests.
   - Credited: **1 request (`200 OK`)**, adding exactly 500 credits.
   - Blocked: **99 requests (`409 Conflict`)**.
   - Network drops / unaccounted: **0**.
   - Total accounted for: **100 / 100 (100.0%)**.
2. **Sliding Window Burst**:
   - Total burst requests dispatched: Exactly 120 concurrent requests against a limit of 100.
   - Allowed requests: **100 (`200 OK`)** (Strictly $\le 100$, zero off-by-one error).
   - Blocked requests: **20 (`429 Too Many Requests`)**.
   - Timestamp collision race leak: **0** (Fixed by `${now}:${crypto.randomUUID()}`).
3. **BullMQ Worker Crash Semantics**:
   - Simulated unhandled worker process crash while holding lock on 15MB document.
   - Before `lockDuration` expiry: Job remains `active` with lock held.
   - After `lockDuration` expiry: Job recovered back to `wait` state in queue.
   - Successive worker picked up job and finished processing: **Completed**.
4. **Redis Outage Graceful Failure**:
   - Disconnected Redis scenario probed with 100 requests.
   - HTTP Status: **`503 Service Unavailable`** (Graceful failure, no gateway freeze).
   - Measured Latency: **p50: 0.000ms, p99: 0.004ms, Mean: 0.000ms**.
* **Raw Artifact**: [`benchmarks/results/verified/raw/system_audits_raw.json`](file:///C:/Users/Rishabh%20Jain/Desktop/github/CortexAI/benchmarks/results/verified/raw/system_audits_raw.json)  
  *SHA256: `10c400a450dcf6802c3281b8defcbbb2ba50ecd3a55f97af08c29bf1d34e3272`*

---

## Cryptographic Manifest (`manifest.sha256`)
```
19d72b66a08e3e41e15bbd37aa974b5b0205fb2e73cafc362e5ba1fe53ec2466  rag_quality_raw.json
6059dfa395dba72f0536866ec76b5a8e53ba27278f413e7110079445c5d2d5ca  prompt_injection_raw.json
c79a3d57d7f8c97d4b9701d60d8eea97396910960757b3c9564bbe16a972b34f  router_accuracy_raw.json
10c400a450dcf6802c3281b8defcbbb2ba50ecd3a55f97af08c29bf1d34e3272  system_audits_raw.json
```
