# Benchmark Verification: Items Awaiting Human Review

*All items requiring human discretion, subjective classification, or manual sign-off are recorded below.*

---

## 1. Model Configuration Discrepancies
- **Gemini Free-Tier Model Selection**:
  - `model.js` specifies `gemini-3.6-flash`.
  - In preflight testing, `gemini-3.6-flash` returned HTTP 429 (`GenerateRequestsPerDayPerProjectPerModel-FreeTier limit 20 exceeded`).
  - `gemini-3.5-flash-lite` was validated and responded successfully with full token usage telemetry.
  - **Review Action Required**: Confirm approval to use `gemini-3.5-flash-lite` for RAG generation and Router Layer 3 evaluations.

- **Groq Model Availability**:
  - `model.js` references `llama-3.3-70b-versatile` and `llama-3.2-11b-vision-preview`.
  - Groq API returns HTTP 404 (`model_not_found`) for these endpoints on the active API key. Active available models on this key are `qwen/qwen3.8-27b`, `openai/gpt-oss-120b`, `allam-2-7b`.
  - **Review Action Required**: Note this in final report; no Groq calls will be made that could fail or fallback to stubs.

---

## 2. Phase 1 RAG Faithfulness & Ground Truth
- *Pending Phase 1 execution*: Any question where the model generated a borderline or partially grounded answer will be logged here with the exact context chunk and answer for human review.

---

## 3. Phase 2 Prompt Injection Attack Vectors
- *Pending Phase 2 execution*: Any prompt injection response that does not cleanly refuse or exhibit typical refusal markers will be logged here for human review.
