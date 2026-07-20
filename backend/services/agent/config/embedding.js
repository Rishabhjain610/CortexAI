import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OllamaEmbeddings } from "@langchain/ollama";
import dotenv from "dotenv";

dotenv.config();

// Embedding model initialization — PDF RAG pipeline ke liye text ko vector space me convert karta hai.
// USE_LOCAL_EMBEDDINGS=true hone par Ollama nomic-embed-text use karta hai (local, free, no API key needed).
// USE_LOCAL_EMBEDDINGS=false (default) par Google Gemini embedding-001 use hota hai (cloud, better quality).
// Naam "geminiEmbeddings" backward compatibility ke liye rakha gaya hai taaki existing imports break na hon.
export const geminiEmbeddings = process.env.USE_LOCAL_EMBEDDINGS === "true"
  ? new OllamaEmbeddings({
      // nomic-embed-text v1.5 — 768-dim vectors, multilingual support, fast local inference
      model: "nomic-embed-text:v1.5",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    })
  : new GoogleGenerativeAIEmbeddings({
      // gemini-embedding-001 — Google ka latest embedding model, 3072-dim vectors, best semantic search quality
      // GEMINI_API_KEY ya GOOGLE_API_KEY dono me se jo bhi set ho use karega
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      model: "gemini-embedding-001",
    });
