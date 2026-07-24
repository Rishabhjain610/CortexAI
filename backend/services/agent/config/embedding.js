import { OllamaEmbeddings } from "@langchain/ollama";
import dotenv from "dotenv";

dotenv.config();

// Local Ollama embedding model (nomic-embed-text:v1.5) — 768-dim vectors, local inference, no cloud API cost/limits
export const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text:v1.5",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434",
});

// Backward compatibility alias for vectorDB.js imports
export const geminiEmbeddings = embeddings;
