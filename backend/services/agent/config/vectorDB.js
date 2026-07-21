import { QdrantVectorStore } from "@langchain/qdrant";
import { geminiEmbeddings } from "./embedding.js";
import dotenv from "dotenv";

dotenv.config();

// vectorStore — PDF ke document chunks ko Qdrant Vector DB me embed aur store karne wala helper.
// Har PDF upload ke liye ek nayi unique collection banti hai (pdf-<timestamp>), taaki conversations isolate rahen.
// QDRANT_ENDPOINT ya QDRANT_END_POINT dono env variable names support kiye hain (backward compatibility).
// QDRANT_API_KEY trim() kiya gaya hai kyunki .env me kabhi kabhi trailing whitespace aa jaata hai.
export const vectorStore = async (docs, collection) => {
  try {
    const store = await QdrantVectorStore.fromDocuments(docs, geminiEmbeddings, {
      // Qdrant server ka base URL — local ya cloud (Qdrant Cloud) dono support karta hai
      url: process.env.QDRANT_ENDPOINT || process.env.QDRANT_END_POINT,
      // trim() important hai — .env me agar key ke aage/peeche spaces hon toh Qdrant 401 Unauthorized deta hai
      apiKey: (process.env.QDRANT_API_KEY || "").trim(),
      // Unique collection name taaki har PDF session ka data alag rahe, cross-contamination na ho
      collectionName: collection,
    });
    return store;
  } catch (error) {
    console.error("Error creating vector store from documents in Qdrant:", error);
    // Error re-throw kiya taaki pdfRagAgent ka caller properly catch kar sake aur user ko error message de sake
    throw error;
  }
};

// getVectorStore — Existing Qdrant collection se retrieve karne ke liye connection load karne ka helper.
// Follow-up queries (bina direct file upload) me purani collection access karne ke liye use hota hai.
export const getVectorStore = (collection) => {
  return new QdrantVectorStore(geminiEmbeddings, {
    url: process.env.QDRANT_ENDPOINT || process.env.QDRANT_END_POINT,
    apiKey: (process.env.QDRANT_API_KEY || "").trim(),
    collectionName: collection,
  });
};