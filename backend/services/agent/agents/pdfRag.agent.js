import fs from "fs";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { vectorStore, getVectorStore } from "../config/vectorDB.js";
import { getModel } from "../config/model.js";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";
import redis from "../../../shared/redis/redis.js";

// PDF RAG Agent: Uploaded PDF documents ko clean karke Qdrant Vector DB me embed aur retrieve karne ke liye main handler
export const pdfRagAgent = async (state) => {
  try {
    // Multi-turn conversation history ko LangChain message format me convert kar rahe hain
    const formattedHistory = (state.history || []).map((msg) => {
      if (msg.role === "user") return new HumanMessage(msg.content);
      return new AIMessage(msg.content);
    });

    let collectionName = null;
    if (state.conversationId) {
      collectionName = await redis.get(
        `pdf:collection:${state.conversationId}`,
      );
    }

    let relevantdocs = [];
    const query =
      (state.prompt || "").trim() ||
      "Summarize the key contents and findings of this PDF document.";

    // 1. Process new uploaded PDF if present
    // PRIORITY: If a new file is attached, ALWAYS process it — even if an old Redis collection exists.
    // This ensures that uploading a new PDF in the same conversation replaces the old context.
    if (state.file && state.file.path) {
      console.log(`[pdfRagAgent] 📄 New PDF detected: ${state.file.originalname || state.file.path}. Processing fresh.`);
      const buffer = fs.readFileSync(state.file.path);
      let text = "";
      try {
        // PDFParse v2 is a CLASS — must be instantiated with { data: buffer } then load() called before getText()
        const parser = new PDFParse({ data: buffer });
        await parser.load(); // loads and decodes the PDF pages internally
        const textResult = await parser.getText();
        text = textResult.text || "";
        console.log(`[pdfRagAgent] ✅ PDF parsed successfully. Raw text length: ${text.length} chars.`);
      } catch (parseErr) {
        console.error("[pdfRagAgent] ❌ PDF parsing failed:", parseErr.message);
        return {
          aiResponse: `Failed to parse the PDF document: ${parseErr.message}. Please ensure the file is a valid, non-password-protected PDF.`,
        };
      }

      // PDF parse footers (jaise '-- 2 of 9 --') aur extra line breaks clean kar rahe hain taaki chunks smooth banein
      const cleanedText = text
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // Document chunking strategy — 1200 size aur 250 overlap ke saath text split kar rahe hain
      // taaki full project descriptions aur titles aapas me break na hon
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1200,
        chunkOverlap: 250,
      });
      const allDocs = await splitter.createDocuments([cleanedText]);
      console.log(
        `\n=================== INITIAL SPLIT CHUNKS (${allDocs.length} total) ===================`,
      );
      allDocs.forEach((doc, idx) => {
        console.log(
          `\n--- Document Chunk ${idx + 1} (${doc.pageContent.length} chars) ---`,
        );
        console.log(doc.pageContent);
      });
      console.log(
        `=======================================================================\n`,
      );

      // Garbage page markers (less than 30 chars) filter out kar rahe hain taaki high quality context embed ho
      const docs = allDocs.filter((d) => d.pageContent.trim().length > 30);
      collectionName = `pdf-${Date.now()}`;
      const store = await vectorStore(
        docs.length > 0 ? docs : allDocs,
        collectionName,
      );

      // New PDF indexed — overwrite old Redis key so follow-ups use the new document
      if (state.conversationId) {
        await redis.set(
          `pdf:collection:${state.conversationId}`,
          collectionName,
          "EX",
          2 * 60 * 60,
        );
        console.log(`[pdfRagAgent] 🔑 Redis collection updated → ${collectionName}`);
      }

      relevantdocs = await store.similaritySearch(query, 10);
    } else if (collectionName) {
      // 2. No file uploaded, but we have a cached collection name in Redis (follow-up query)
      console.log(
        `Using existing PDF collection for follow-up query: ${collectionName}`,
      );
      const store = getVectorStore(collectionName);
      relevantdocs = await store.similaritySearch(query, 10);
    } else {
      // 3. No file and no collection name in Redis -> Fall back to history-only analysis
      if (state.history && state.history.length > 0) {
        const llm = getModel("pdfRagAgent");
        const messages = [
          new SystemMessage(
            "You are CortexAI, an expert PDF analysis assistant. The user previously uploaded a PDF document in this conversation. Answer their follow-up question using the conversation history. Do NOT ask them to re-upload the file.",
          ),
          ...formattedHistory,
          new HumanMessage(state.prompt || ""),
        ];
        const response = await llm.invoke(messages);
        return { aiResponse: response.content };
      }
      return {
        aiResponse:
          "No active PDF session or file was provided to the PDF RAG Agent.",
      };
    }

    const context = relevantdocs.map((d) => d.pageContent).join("\n\n");
    console.log(
      `\n=================== VECTOR DB RETRIEVAL ===================`,
    );
    console.log(`Query: "${query}"`);
    console.log(
      `Retrieved ${relevantdocs.length} context chunk(s) from Qdrant Vector DB:\n`,
    );
    relevantdocs.forEach((doc, idx) => {
      console.log(`--- Chunk ${idx + 1} (${doc.pageContent.length} chars) ---`);
      console.log(doc.pageContent);
    });
    console.log(
      `===========================================================\n`,
    );

    // LLM model load karke strict RAG prompt pass kar rahe hain
    const llm = getModel("pdfRagAgent");

    const messages = [
      new SystemMessage(
        `You are CortexAI, an expert PDF document analysis assistant. The user has already uploaded a PDF document and its full text content has been extracted and provided to you below in the Context section.

CRITICAL RULES — READ CAREFULLY:
- The document content is ALREADY available to you in the Context section below. Do NOT ask the user to upload or re-upload any file.
- Do NOT say "the file didn't come through" or "I can't see the attachment". You already have the full text content.
- Answer the user's question using ONLY the text provided in the Context section.
- If the user asks "what is this" or "summarize this", describe and summarize the document content from the Context.
- Every factual claim must be supported by the Context. Do not invent or infer data not present in the text.
- If the context does not contain enough information to answer reliably, say clearly that the information is not in the document.
- Be concise and direct. Do not add unnecessary filler text.

Context (extracted text from the uploaded PDF document):
${context}`,
      ),
      ...formattedHistory,
      new HumanMessage(query),
    ];

    const response = await llm.invoke(messages);

    return {
      aiResponse: response.content,
    };
  } catch (error) {
    console.error("Error in pdfRagAgent:", error);
    return {
      aiResponse: `Error in pdfRagAgent: ${error.message}`,
    };
  }
};
