import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenRouter } from "@langchain/openrouter";
import dotenv from "dotenv";

dotenv.config();

// Groq Qwen model — chat, search, intent classification ke liye (thinking model)
export const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3.6-27b",
});

// Groq LLaMA model — structured JSON output tasks ke liye (NON-thinking model, no <think> tokens)
// PDF/PPT agents ko yahi use karna chahiye taaki JSON parsing clean rahe
export const groqStructured = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile", // Fast, non-reasoning model — JSON output reliable rehta hai
  temperature: 0,
});

// Ollama config: local model running and testing ke liye client.
export const ollama = new ChatOllama({
  model: "minimax-m3:cloud",
  baseUrl: "http://localhost:11434",
  numPredict: 4096, // Response truncation ko prevent karne ke liye generation limit badhai
  numCtx: 16384, // Context overflow ko prevent karne ke liye window size badhai
});

// OpenRouter model configurations - deepseek only (no fallback backup models)
export const deepseek = new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature: 0,
  maxTokens: 8192,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
});

// Agent roles mapping function: Sahi agent ko sahi model dispatch karne ke liye router.
export const getModel = (agent) => {
  switch (agent) {
    case "chatAgent":
      return ollama; // Chat Agent ke liye local Ollama Minimax — no rate limits
    case "codingAgent":
      return deepseek; // Code generation ke liye deepseek return karte hain.
    case "pdfAgent":
      return ollama; // PDF ke liye Ollama Minimax model use kar rahe hain.
    case "pptAgent":
      return ollama; // PPT ke liye Ollama Minimax model use kar rahe hain.
    case "searchAgent":
      return groq; // Search classification ke liye Groq Qwen.
    case "imageAgent":
      return groq; // Image prompt ke liye Groq Qwen.
    default:
      return groq; // Kuchh select na hone par Groq default fallback hai.
  }
};
