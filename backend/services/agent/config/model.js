import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenRouter } from "@langchain/openrouter";
import dotenv from "dotenv";

dotenv.config();

// Groq API client config: Intent classification aur light tasks ke liye Qwen model use kar rahe hain.
export const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3.6-27b",
});

// Ollama config: local model running and testing ke liye client.
export const ollama = new ChatOllama({
  model: "minimax-m3:cloud",
  baseUrl: "http://localhost:11434",
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
      return ollama; // Normal chat ke liye local/ollama use karte hain.
    case "intent":
      return groq;   // User intent samajhne ke liye fast groq model use karte hain.
    case "codingAgent":
      return deepseek;   // Code generation ke liye deepseek return karte hain.
    case "pdfAgent":
      return groq;
    case "searchAgent":
      return groq;
    case "pptAgent":
      return groq;
    case "imageAgent":
      return groq;
    default:
      return groq;   // Kuchh select na hone par Groq default fallback hai.
  }
};