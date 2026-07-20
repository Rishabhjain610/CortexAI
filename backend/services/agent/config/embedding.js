import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OllamaEmbeddings } from "@langchain/ollama";
import dotenv from "dotenv";

dotenv.config();

// Text embeddings model client initialization (named geminiEmbeddings for backward compatibility)
export const geminiEmbeddings = process.env.USE_LOCAL_EMBEDDINGS === "true"
  ? new OllamaEmbeddings({
      model: "nomic-embed-text:v1.5",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    })
  : new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      model: "gemini-embedding-001",
    });

