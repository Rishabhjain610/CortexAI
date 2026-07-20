import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenRouter } from "@langchain/openrouter";
import dotenv from "dotenv";

dotenv.config();

// Groq Qwen — chat, search, intent classification (thinking model)
export const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3.6-27b",
});

// Groq LLaMA — structured JSON output (PDF/PPT agents, non-thinking, clean JSON)
export const groqStructured = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0,
});

// Groq Qwen Vision — image analysis (multimodal: VQA, OCR, up to 5 images per request)
export const groqVision = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3.6-27b",
  temperature: 0.2,
});

// Ollama — local minimax model (chat agent only)
export const ollama = new ChatOllama({
  model: "minimax-m3:cloud",
  baseUrl: "http://localhost:11434",
  numPredict: 4096,
  numCtx: 16384,
});

// OpenRouter — DeepSeek (coding agent only)
export const deepseek = new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature: 0,
  maxTokens: 8192,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
});

// Agent routing
export const getModel = (agent) => {
  switch (agent) {
    case "chatAgent":
      return ollama; // Chat — Ollama Minimax (local)
    case "codingAgent":
      return deepseek; // Code — OpenRouter DeepSeek
    case "pdfAgent":
      return groqStructured; // PDF generation — Groq LLaMA (structured JSON)
    case "pptAgent":
      return groqStructured; // PPT generation — Groq LLaMA (structured JSON)
    case "searchAgent":
      return groq; // Search classification — Groq Qwen
    case "imageAgent":
      return groq; // Image prompt generation — Groq Qwen
    case "imageAnalyzer":
      return groqVision; // Vision analysis — Groq Qwen Vision
    case "pdfRagAgent":
      return ollama; // PDF RAG — Ollama Minimax
    default:
      return groq;
  }
};
