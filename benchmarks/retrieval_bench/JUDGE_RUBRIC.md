# CortexAI RAG Evaluation Judge Rubric

This rubric defines the deterministic rules for the LLM-as-a-Judge evaluation conducted in Phase 4 of the CortexAI Retrieval Benchmark.

**Generator Model:** Google Gemini (`gemini-3.1-flash-lite` / standard tier) via Google Generative Language API  
**Judge Model:** Groq `openai/gpt-oss-120b` (`temperature: 0`) via Groq Cloud API  

---

## 1. Metrics & Criteria

### Metric 1: Answer Correctness (`correctness`)
- **Applicability:** Evaluated on all **answerable** questions against the human ground truth answer.
- **Score:** Binary (1 or 0).
- **Rule:**
  - `1`: The generated answer conveys the core factual claim, entity name, amount, or technical specification asserted in the ground truth answer (minor phrasing, stylistic differences, or synonyms are permitted).
  - `0`: The generated answer contradicts the ground truth, provides an incorrect number/name, omits the core fact, or wrongly refuses an answerable question.

### Metric 2: Faithfulness (`faithfulness`)
- **Applicability:** Evaluated on all questions.
- **Score:** Binary (1 or 0).
- **Rule:**
  - `1`: Every factual assertion in the generated answer is directly grounded in or logically entailed by the retrieved context chunks provided to the generator.
  - `0`: The answer contains external hallucinations, ungrounded claims, or fabricated entities/numbers not found in the context.

### Metric 3: Refusal Accuracy (`refusal_accuracy`)
- **Applicability:** Evaluated separately for:
  1. **Unanswerable questions:**
     - `Correct Refusal (1)`: The model explicitly refuses to answer or states that the requested information (e.g. personal phone number, 2029 budget subsidies, Paris campus) is not provided in the document.
     - `False Acceptance (0)`: The model hallucinates or guesses an answer to an unanswerable question.
  2. **Answerable questions:**
     - `Wrong Refusal (1)`: The model states the information is missing when the question was designated answerable.
     - `Valid Response (0)`: The model provides an answer.

### Metric 4: Retrieval Hit vs Miss Conditioning
- **Breakdown:** Correctness is computed conditioned on whether the retrieval step achieved a `hit` (relevant answer-bearing chunk present in top-k) versus a `miss` (relevant chunk absent).
- **Hypothesis:** Correctness given `miss` measures hallucination/prior parametric bias; correctness given `hit` measures generator comprehension.

---

## 2. Judge Prompt Format
```json
{
  "system": "You are an objective evaluation judge auditing an AI retrieval-augmented generation (RAG) system. Assess the candidate answer strictly against the provided context and ground truth. Output valid JSON only with keys: correctness (0 or 1), faithfulness (0 or 1), is_refusal (true or false), explanation (concise string).",
  "temperature": 0
}
```

