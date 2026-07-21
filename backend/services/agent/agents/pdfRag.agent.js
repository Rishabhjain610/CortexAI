import fs from "fs";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { vectorStore, getVectorStore } from "../config/vectorDB.js";
import { getModel } from "../config/model.js";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
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
      collectionName = await redis.get(`pdf:collection:${state.conversationId}`);
    }

    let relevantdocs = [];
    const query = (state.prompt || "").trim() || "Summarize the key contents and findings of this PDF document.";

    // 1. Process new uploaded PDF if present
    if (state.file && state.file.path) {
      const buffer = fs.readFileSync(state.file.path);
      let text = "";
      try {
        if (typeof PDFParse === "function") {
          try {
            const parser = new PDFParse({ data: buffer });
            const textResult = await parser.getText();
            text = textResult.text || "";
          } catch {
            const data = await PDFParse(buffer);
            text = data.text || "";
          }
        } else {
          text = String(buffer);
        }
      } catch (parseErr) {
        console.error("PDF parsing failed in pdfRagAgent:", parseErr);
        return { aiResponse: `Failed to parse PDF document: ${parseErr.message}` };
      }

      // PDF parse footers (jaise '-- 2 of 9 --') aur extra line breaks clean kar rahe hain taaki chunks smooth banein
      const cleanedText = text
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // Document chunking strategy — 1000 size aur 150 overlap ke saath text split kar rahe hain
      // Document chunking strategy — 1200 size aur 250 overlap ke saath text split kar rahe hain
      // taaki full project descriptions aur titles aapas me break na hon
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1200,
        chunkOverlap: 250,
      });
      const allDocs = await splitter.createDocuments([cleanedText]);
      console.log(`\n=================== INITIAL SPLIT CHUNKS (${allDocs.length} total) ===================`);
      allDocs.forEach((doc, idx) => {
        console.log(`\n--- Document Chunk ${idx + 1} (${doc.pageContent.length} chars) ---`);
        console.log(doc.pageContent);
      });
      console.log(`=======================================================================\n`);

      // Garbage page markers (less than 30 chars) filter out kar rahe hain taaki high quality context embed ho
      const docs = allDocs.filter(d => d.pageContent.trim().length > 30);
      collectionName = `pdf-${Date.now()}`;
      const store = await vectorStore(docs.length > 0 ? docs : allDocs, collectionName);

      // Save collection name in Redis for follow-up questions (expires in 2 hours)
      if (state.conversationId) {
        await redis.set(`pdf:collection:${state.conversationId}`, collectionName, "EX", 2 * 60 * 60);
      }

      relevantdocs = await store.similaritySearch(query, 10);
    } else if (collectionName) {
      // 2. No file uploaded, but we have a cached collection name in Redis (follow-up query)
      console.log(`Using existing PDF collection for follow-up query: ${collectionName}`);
      const store = getVectorStore(collectionName);
      relevantdocs = await store.similaritySearch(query, 10);
    } else {
      // 3. No file and no collection name in Redis -> Fall back to history-only analysis
      if (state.history && state.history.length > 0) {
        const llm = getModel("pdfRagAgent");
        const messages = [
          new SystemMessage("You are CortexAI, an expert PDF analysis assistant. Answer the user's follow-up question directly and accurately using the conversation history."),
          ...formattedHistory,
          new HumanMessage(state.prompt || "")
        ];
        const response = await llm.invoke(messages);
        return { aiResponse: response.content };
      }
      return { aiResponse: "No active PDF session or file was provided to the PDF RAG Agent." };
    }

    const context = relevantdocs.map(d => d.pageContent).join("\n\n");
    console.log(`\n=================== VECTOR DB RETRIEVAL ===================`);
    console.log(`Query: "${query}"`);
    console.log(`Retrieved ${relevantdocs.length} context chunk(s) from Qdrant Vector DB:\n`);
    relevantdocs.forEach((doc, idx) => {
      console.log(`--- Chunk ${idx + 1} (${doc.pageContent.length} chars) ---`);
      console.log(doc.pageContent);
    });
    console.log(`===========================================================\n`);
    
    // LLM model load karke strict RAG prompt pass kar rahe hain
    const llm = getModel("pdfRagAgent");
    
    const messages = [
      new SystemMessage(
        `You are CortexAI, an expert PDF analysis assistant. Your job is to answer the user's question directly and accurately using ONLY the provided PDF document context.

Strict Instructions:
1. Answer the user's exact question directly using only the provided evidence.
2. When listing or summarizing projects or work, clearly distinguish between "Independent / Personal Projects" (from the Projects section) and "Work Experience / Internship Projects" (from the Experience section).
3. Include only information necessary to answer the question. Do not include unnecessary additional details or loosely related facts from the context.
4. If the answer is a single fact, name, date, or number, provide a concise single-sentence or single-phrase response.
5. Every material factual claim in your answer must be supported by the context. Do not invent, infer, or extrapolate numbers, dates, policies, conditions, eligibility rules, or procedures.
6. If the context does not contain enough information to answer the question reliably, reply stating clearly that the information is not present in the document.

Context:
${context}`
      ),
      ...formattedHistory,
      new HumanMessage(query)
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
