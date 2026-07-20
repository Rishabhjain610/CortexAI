import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenRouter } from "@langchain/openrouter";
import dotenv from "dotenv";

dotenv.config();

// Groq Qwen 27B — Chat, Search query understanding, intent classification ke liye use hota hai.
// Yeh ek "thinking" model hai jo <think>...</think> tags output karta hai, isliye frontend ThoughtBox render kar sakta hai.
export const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3.6-27b",
});

// Groq LLaMA 70B — Structured JSON output ke liye use hota hai (PDF/PPT agents).
// temperature: 0 — Deterministic output chahiye taaki JSON format hamesha valid rahe aur parsing fail na ho.
// Qwen nahi, kyunki LLaMA 70B ka JSON formatting zyada consistent hota hai non-thinking mode me.
export const groqStructured = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0,
});

// Groq Qwen Vision — Uploaded images analyze karne ke liye multimodal model.
// temperature: 0.2 — Thoda creativity allow kiya hai taaki image descriptions descriptive hon, lekin hallucinate na kare.
// Groq ke Qwen model ko image_url: { url: "data:..." } format me hi image dena padta hai (string nahi).
export const groqVision = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3.6-27b",
  temperature: 0.2,
});

// Ollama Minimax — Local model, internet nahi chahiye, API rate limits nahi hain.
// numPredict: 4096 — Maximum output tokens limit set kiya hai taaki response truncate na ho.
// numCtx: 16384 — Context window size, badi history aur long conversations ke liye enough hai.
// chatAgent aur pdfRagAgent dono ke liye use hota hai — low-latency local inference.
export const ollama = new ChatOllama({
  model: "minimax-m3:cloud",
  baseUrl: "http://localhost:11434",
  numPredict: 4096,
  numCtx: 16384,
});

// OpenRouter DeepSeek — Coding agent ke liye specialized model.
// temperature: 0 — Code generation me creativity nahi chahiye, exact aur deterministic output chahiye.
// maxTokens: 8192 — Complex code files aur explanations ke liye bada token limit set kiya hai.
// Agar OpenRouter credits khatam hon ya 429 rate limit aye, deepseek.withFallbacks([groqStructured]) use karo.
export const deepseek = new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature: 0,
  maxTokens: 8192,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
});

// getModel — Agent name se sahi LLM instance return karne wala dispatcher function.
// Default fallback: Agar koi unknown agent name aaye toh groq (Qwen) return karo — safe fallback.
export const getModel = (agent) => {
  switch (agent) {
    case "chatAgent":
      return ollama; // Chat — Ollama Minimax (local, no API limits)
    case "codingAgent":
      return deepseek; // Code — OpenRouter DeepSeek (best for code)
    case "pdfAgent":
      return groqStructured; // PDF generation — Groq LLaMA (structured JSON needed)
    case "pptAgent":
      return groqStructured; // PPT generation — Groq LLaMA (structured JSON needed)
    case "searchAgent":
      return groq; // Search classification — Groq Qwen (thinking model for intent)
    case "imageAgent":
      return groq; // Image prompt generation — Groq Qwen
    case "imageAnalyzer":
      return groqVision; // Vision analysis — Groq Qwen Vision (multimodal)
    case "pdfRagAgent":
      return ollama; // PDF RAG — Ollama Minimax (local, no API cost for heavy RAG workloads)
    default:
      return groq; // Unknown agent — safe fallback to Groq Qwen
  }
};
