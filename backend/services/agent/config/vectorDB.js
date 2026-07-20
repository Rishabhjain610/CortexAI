import { QdrantVectorStore } from "@langchain/qdrant";
import { geminiEmbeddings } from "./embedding.js";
import dotenv from "dotenv";
dotenv.config();
// Qdrant vector store connection helper to upload new document chunks
export const vectorStore = async (docs, collection) => {
  try {
    const store = await QdrantVectorStore.fromDocuments(docs, geminiEmbeddings, {
      url: process.env.QDRANT_ENDPOINT || process.env.QDRANT_END_POINT,
      apiKey: (process.env.QDRANT_API_KEY || "").trim(),
      collectionName: collection,
    });
    return store;
  } catch (error) {
    console.error("Error creating vector store from documents in Qdrant:", error);
    throw error;
  }
};