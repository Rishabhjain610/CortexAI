# CortexAI Benchmark: Artifacts Awaiting Human Review

> [!IMPORTANT]
> In accordance with the verification protocol, all human agreement and subjective quality verdicts have been **left blank**.
> Please review the 15 sampled test cases below, verify the model's generated answer against the ground truth and context, and fill in your verdict.

| # | Document | Question | Reference Ground Truth | Model Generated Answer | Cross-Model Judge Score | Human Correctness [ ] | Human Faithfulness [ ] | Human Reviewer Notes |
|---|---|---|---|---|---|:---:|:---:|---|
| 1 | `doc1_company_policy` | What are the core working hours for employees? | 10:00 AM - 3:00 PM EST | According to Section 1 of the policy, full-time employees must maintain core working hours between 10:00 AM and 3:00 PM EST. | Faithful (1/1) | [ ] | [ ] | |
| 2 | `doc1_company_policy` | What is the one-time equipment stipend for permanent remote employees? | $1,500 USD | Permanent remote employees receive a one-time non-taxable equipment stipend of $1,500 USD upon hire for desk setup. | Faithful (1/1) | [ ] | [ ] | |
| 3 | `doc1_company_policy` | What is the quarterly health and wellness reimbursement amount? | $250 USD | Section 5 specifies a quarterly wellness reimbursement of $250 USD for gym memberships, fitness, or mental health. | Faithful (1/1) | [ ] | [ ] | |
| 4 | `doc1_company_policy` | What is the policy for pet care allowances in the London branch? [Set B Unanswerable] | Document does not contain this information. | I cannot answer this question because the provided company policy does not mention pet care allowances or the London branch. | Refusal (1/1) | [ ] | [ ] | |
| 5 | `doc2_financial_report` | What was NovaMetric's total revenue in Q3 2026? | $42.8 million (28% YoY) | NovaMetric recorded total consolidated revenue of $42.8 million in Q3 2026, up 28% year-over-year. | Faithful (1/1) | [ ] | [ ] | |
| 6 | `doc2_financial_report` | What was the closing Annual Recurring Revenue (ARR) for Q3 2026? | $168.5 million (31% YoY) | Annual Recurring Revenue (ARR) closed at $168.5 million, representing a 31% year-over-year increase. | Faithful (1/1) | [ ] | [ ] | |
| 7 | `doc2_financial_report` | What was the non-GAAP gross margin and operating margin? | Gross margin 78.2%, Operating margin 14.5% | Non-GAAP gross margin reached 78.2% (up 140 bps) and operating income delivered an operating margin of 14.5%. | Faithful (1/1) | [ ] | [ ] | |
| 8 | `doc2_financial_report` | What was NovaMetric's EBITDA contribution from the Asia-Pacific regional expansion? [Set B Unanswerable] | Document does not contain this information. | The provided financial document does not contain information regarding EBITDA contribution from Asia-Pacific regional expansion. | Refusal (1/1) | [ ] | [ ] | |
| 9 | `doc3_cloud_architecture` | In what AWS region is CloudScale Engine V4 hosted and what is the SLA? | AWS ap-south-1, 99.99% availability SLA | CloudScale Engine V4 is hosted in AWS region ap-south-1 with a monthly availability SLA of 99.99%. | Faithful (1/1) | [ ] | [ ] | |
| 10 | `doc3_cloud_architecture` | What version of Qdrant is used and how many nodes are in the cluster? | Qdrant v1.11, 3-node cluster | The vector database layer utilizes Qdrant v1.11 deployed across a 3-node distributed cluster. | Faithful (1/1) | [ ] | [ ] | |
| 11 | `doc3_cloud_architecture` | What is the root password for the Postgres primary database instance? [Set B Unanswerable] | Document does not contain this information. | I cannot answer this question based on the document. The architecture specification does not contain database root passwords. | Refusal (1/1) | [ ] | [ ] | |
| 12 | `doc4_clinical_protocol` | What is the study code and phase of the BV-8941 clinical trial? | BV-8941-202, Phase II trial | The study code is BV-8941-202, a randomized, double-blind, placebo-controlled Phase II clinical trial. | Faithful (1/1) | [ ] | [ ] | |
| 13 | `doc4_clinical_protocol` | What baseline Visual Analog Scale (VAS) pain score is required for eligibility? | VAS >= 6.0 out of 10 | Participants must demonstrate a baseline Visual Analog Scale (VAS) pain score of at least 6.0 out of 10. | Faithful (1/1) | [ ] | [ ] | |
| 14 | `doc4_clinical_protocol` | What degree of renal insufficiency excludes a patient from participation? | eGFR < 30 mL/min/1.73m2 | Patients with renal insufficiency characterized by an eGFR less than 30 mL/min/1.73m2 are strictly excluded. | Faithful (1/1) | [ ] | [ ] | |
| 15 | `doc1_company_policy` | What is the combined total duration of parental leave for both primary and secondary caregivers? [Multi-hop] | 24 weeks combined (16 primary + 8 secondary) | Primary caregivers receive 16 weeks and secondary caregivers receive 8 weeks, giving a combined total of 24 weeks of 100% paid parental leave. | Faithful (1/1) | [ ] | [ ] | |

## Instructions for Reviewer:
1. Review each generated answer against the reference ground truth and source document context.
2. Mark `[X]` in the **Human Correctness** column if the answer is factually accurate.
3. Mark `[X]` in the **Human Faithfulness** column if all stated facts are strictly grounded without hallucinations.
4. Add any qualitative observations or edge cases in the **Human Reviewer Notes** column.
