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

// OpenRouter model configurations
const deepseek = new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature: 0,
  maxTokens: 25000,
});

const qwenCoder = new ChatOpenRouter({
  model: "qwen/qwen-2.5-coder-32b-instruct",
  temperature: 0,
  maxTokens: 25000,
});

const geminiFlash = new ChatOpenRouter({
  model: "google/gemini-2.5-flash",
  temperature: 0,
  maxTokens: 25000,
});

// Chain mapping: DeepSeek down hone par automatic Qwen Coder aur fir Gemini Flash par switch ho jayega (resilience implementation).
export const openrouter = deepseek.withFallbacks([qwenCoder, geminiFlash]);

// Agent roles mapping function: Sahi agent ko sahi model dispatch karne ke liye router.
export const getModel = (agent) => {
  switch (agent) {
    case "chatAgent":
      return ollama; // Normal chat ke liye local/ollama use karte hain.
    case "intent":
      return groq;   // User intent samajhne ke liye fast groq model use karte hain.
    case "codingAgent":
      return openrouter;   // Code generation ke liye high capability wala openrouter model stack return karte hain.
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