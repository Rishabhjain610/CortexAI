import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import dotenv from "dotenv";

dotenv.config();

export const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "qwen/qwen3.6-27b",
});

export const ollama = new ChatOllama({
  model: "minimax-m3:cloud", // Use your specific local model name here
  baseUrl: "http://localhost:11434",
});

export const getModel = (agent) => {
  switch (agent) {
    case "chatAgent":
      return ollama; // Use local Ollama model for chat
    case "codingAgent":
      return groq;   // Use high-performance Groq for coding
    case "pdfAgent":
      return groq;
    case "searchAgent":
      return groq;
    case "pptAgent":
      return groq;
    case "imageAgent":
      return groq;
    default:
      return groq;   // Fallback to Groq
  }
};