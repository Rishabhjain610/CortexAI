# CortexAI Benchmark Verification Plan (Phase 0)

## Executive Summary
This document establishes the verified benchmarking protocol for CortexAI. The previous benchmark run utilized an LLM stub server (`:9000`) and mock hash-embeddings (`LLM_STUB_MODE=1`), rendering previous RAG-quality, prompt-injection, and router accuracy metrics invalid.

This plan outlines the re-benchmarking procedure using **real embedding models (Ollama `nomic-embed-text:v1.5`)**, **real LLMs (`gemini-3.5-flash-lite`, `deepseek/deepseek-chat`)**, and **real Qdrant vector storage**, backed by strict reproducibility rules, atomic raw output logging, and sha256 checksum manifests.

---

## Hard Verification Rules
1. **Fail Loudly, Never Fall Back**: A preflight guard in `benchmarks/preflight.py` verifies zero stub flags (`LLM_STUB_MODE=0`, no stub endpoints `:9000`), active Ollama nomic embedding service, and healthy Qdrant collection. If an API key, quota, or network call fails, execution stops immediately.
2. **Raw Output Provenance**: Every metric must be computed from raw JSON logs written directly by test runners into `benchmarks/results/verified/raw/`. No manual edits.
3. **Sha256 Manifest**: After each benchmark phase, a cryptographically signed sha256 manifest of all raw artifacts is generated.
4. **Token & Provider Accounting**: Report provider-returned token counts (prompt tokens, completion tokens, cached tokens) and exact model versions.
5. **Hard Budget Cap**: **$5.00 USD**. All responses cached on disk keyed by `(model, prompt, params)`. Run halts immediately if spend exceeds budget.
6. **Isolated Branch & Git Protocol**: Branch `bench-verified`. One atomic commit per phase. Strictly no business logic changes.
7. **Secret Scrubbing**: Automatic pre-commit scanning for credentials (`AIza`, `gsk_`, `sk-`, `rzp_`, `mongodb+srv`). All payment tests run in test mode or local mock.
8. **Human Review Isolation**: Any subjective or borderline edge cases are logged directly into `benchmarks/NEEDS_HUMAN_REVIEW.md`.

---

## Phase 0 Preflight Verification (Completed)

| Verification Item | Specification / Value | Status |
|---|---|---|
| **Embeddings Service** | Ollama `http://localhost:11434` | **PASS** |
| **Embedding Model** | `nomic-embed-text:v1.5` | **PASS** |
| **Model Digest / ID** | `0a109f422b47` (`sha256-970aa74c0a90ef...`) | **RECORDED** |
| **Embedding Dimension** | 768 dimensions | **VERIFIED** |
| **Cosine Sanity Check (5 Pairs)** | Paraphrase: `0.8411` vs Unrelated: `0.3740` (+0.4671 separation, 0 overlaps) | **PASS** |
| **Qdrant Real Vector Collection** | `cortexai_verified_nomic_v15` (dim: 768, distance: Cosine) | **CREATED & VERIFIED** |
| **Configured Models (`model.js`)** | `chatAgent`: Gemini, `codingAgent`: DeepSeek V3, `pdfRagAgent`: Gemini, `searchAgent`: Groq | **READ FROM CODE** |
| **Active Verification LLM** | `gemini-3.5-flash-lite` (Token reporting active; `gemini-3.6-flash` rate-limited at 20 req/day) | **PASS** |
| **Real Model Smoke Test (3 Qs)** | 3 queries end-to-end (Grounded Q1: 74 tok, Grounded Q2: 86 tok, Refusal Q3: 57 tok) | **PASS** |

---

## Execution Plan & Budget Estimation

| Phase | Description | Real Model / Service | Planned Calls | Est. Tokens | Est. Cost (USD) | Est. Runtime |
|---|---|---|:---:|:---:|:---:|:---:|
| **Phase 1** | **RAG Retrieval & Answer Quality**<br>- Set A: In-domain policy QA (24 pairs)<br>- Set B: Out-of-domain / adversarial (24 pairs)<br>Metrics: Recall@3, Recall@5, MRR, Faithfulness, Refusal Rate | Ollama `nomic-embed-text:v1.5`<br>`gemini-3.5-flash-lite` | 48 queries<br>+ 48 embeddings | ~20,000 | ~$0.010 | ~2.5 min |
| **Phase 2** | **Prompt Injection Resilience**<br>- 20 attack vectors (jailbreaks, exfiltration, roleplay bypass, delimiter injection) | `gemini-3.5-flash-lite` | 20 attacks | ~6,000 | ~$0.003 | ~1.0 min |
| **Phase 3** | **Router Accuracy After Layer 3 Fix**<br>- 80 prompts across 6 intents (`chat`, `code`, `pdf`, `ppt`, `search`, `image`)<br>- Measures Layer 1/2 heuristics + Layer 3 LLM fallback | `gemini-3.5-flash-lite`<br>(Layer 3 fallback only) | ~35 LLM calls<br>+ 80 routed | ~5,500 | ~$0.002 | ~1.5 min |
| **Phase 4** | **Systematic Sanity Audits**<br>- Payment replay: 100 concurrent requests trace<br>- Sliding window: 120 parallel burst test<br>- BullMQ worker crash & lock recovery<br>- Redis outage graceful failure latency (ms) | Node.js / Python<br>Docker containers | 0 paid calls | 0 | $0.000 | ~2.0 min |
| **Total** | **Full Verification Suite** | | **~103 LLM calls** | **~31,500** | **~$0.015** | **~7.0 min** |

- **Hard Budget Limit**: $5.00 USD
- **Expected Total Spend**: **$0.015 USD** (< 0.5% of hard cap)
- **Response Caching**: Enabled via `benchmarks/results/verified/cache.json`

---

## Identified Risks & Mitigations

1. **Gemini Free-Tier Rate Limits (RPM / RPD)**:
   - *Risk*: Rapid bursting can trigger HTTP 429 quota exhaustion.
   - *Mitigation*: Rate throttle of 1 request every 2.0 seconds with exponential jittered backoff (up to 3 retries). Disk caching avoids duplicate calls.
2. **Groq Model Availability**:
   - *Risk*: `llama-3.3-70b-versatile` configured in `model.js` returned 404 on current user key.
   - *Mitigation*: For structured generation/fallbacks, utilize available active models (`gemini-3.5-flash-lite` or OpenRouter `deepseek-chat`). Document in review notes.
3. **Data Contamination / Stub Leakage**:
   - *Risk*: Old stub vectors in Qdrant or stub server running in background.
   - *Mitigation*: Background stub server killed (`task-807` terminated). Preflight strictly checks for port 9000 absence and verifies fresh Qdrant collection `cortexai_verified_nomic_v15`.
4. **Subjective Ground Truth**:
   - *Risk*: Over-claiming human verification or faithfulness without human signoff.
   - *Mitigation*: Ambiguous items flagged in `benchmarks/NEEDS_HUMAN_REVIEW.md` for user inspection.

---

## Status
- **Phase 0**: **COMPLETE** (Preflight passed, real models validated, environment secured).
- **Waiting for User Approval** before executing Phase 1.

