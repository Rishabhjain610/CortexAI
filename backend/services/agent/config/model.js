import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";
import dotenv from "dotenv";
import { getStubModel } from "./stubModel.js";

dotenv.config();

// Groq Qwen 27B — Chat, Search query understanding, intent classification ke liye use hota hai.
// Yeh ek "thinking" model hai jo <think>...</think> tags output karta hai, isliye frontend ThoughtBox render kar sakta hai.
export const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3.8-27b",
});

// Groq LLaMA 70B — Structured JSON output ke liye use hota hai (PDF/PPT agents).
// temperature: 0 — Deterministic output chahiye taaki JSON format hamesha valid rahe aur parsing fail na ho.
// Qwen nahi, kyunki LLaMA 70B ka JSON formatting zyada consistent hota hai non-thinking mode me.
export const groqStructured = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0,
});

// Groq LLaMA Vision — Uploaded images analyze karne ke liye multimodal model.
export const groqVision = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.2-11b-vision-preview",
  temperature: 0.2,
});

// Ollama Minimax — Local model, internet nahi chahiye, API rate limits nahi hain.
// numPredict: 4096 — Maximum output tokens limit set kiya hai taaki response truncate na ho.
// numCtx: 16384 — Context window size, badi history aur long conversations ke liye enough hai.
// chatAgent aur pdfRagAgent dono ke liye use hota hai — low-latency local inference.
export const gemini = new ChatGoogleGenerativeAI({
  model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  apiKey: process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_FALLBACK,
  maxRetries: 3,
});

// OpenRouter DeepSeek — Coding agent ke liye specialized model.
// temperature: 0 — Code generation me creativity nahi chahiye, exact aur deterministic output chahiye.
// maxTokens: 8192 — Complex code files aur explanations ke liye bada token limit set kiya hai.
export const deepseek = new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature: 0,
  maxTokens: 8192,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
});

// getModel — Agent name se sahi LLM instance return karne wala dispatcher function.
// Default fallback: Agar koi unknown agent name aaye toh groq (Qwen) return karo — safe fallback.
export const getModel = (agent) => {
  if (process.env.BENCH_MODE === "1" && process.env.LLM_STUB_MODE === "1") {
    return getStubModel(agent);
  }
  switch (agent) {
    case "chatAgent":
      return gemini; // Chat — Gemini model
    case "codingAgent":
      return deepseek; // Code — OpenRouter DeepSeek V3
    case "pdfAgent":
      return groqStructured; // PDF generation — Groq LLaMA (structured JSON needed)
    case "pptAgent":
      return groqStructured; // PPT generation — Groq LLaMA (structured JSON needed)
    case "searchAgent":
      return groq; // Search — Groq Qwen 27B (thinking model)
    case "imageAgent":
      return groq; // Image prompt generation — Groq Qwen 27B
    case "imageAnalyzer":
      return groqVision; // Vision analysis — Groq LLaMA Vision (multimodal)
    case "pdfRagAgent":
      return gemini; // PDF RAG — Gemini model
    default:
      return groq; // Unknown agent — safe fallback to Groq Qwen
  }
};
