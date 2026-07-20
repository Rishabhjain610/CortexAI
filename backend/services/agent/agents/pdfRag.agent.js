import fs from "fs";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { vectorStore } from "../config/vectorDB.js";
import { getModel } from "../config/model.js";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

// PDF RAG Agent: Uploaded PDF documents ko clean karke Qdrant Vector DB me embed aur retrieve karne ke liye main handler
export const pdfRagAgent = async (state) => {
  try {
    // Multi-turn conversation history ko LangChain message format me convert kar rahe hain
    const formattedHistory = (state.history || []).map((msg) => {
      if (msg.role === "user") return new HumanMessage(msg.content);
      return new AIMessage(msg.content);
    });

    // Agar koi file upload nahi hui hai par purani conversation history exist karti hai toh follow-up handle karo
    if (!state.file || !state.file.path) {
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
      return { aiResponse: "No file was provided to the PDF RAG Agent." };
    }

    // Disk se raw PDF file buffer read kar rahe hain
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
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 150,
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
    const collectionName = `pdf-${Date.now()}`;
    const store = await vectorStore(docs.length > 0 ? docs : allDocs, collectionName);

    // Vector database (Qdrant) me top 3 most relevant chunks search kar rahe hain
    const query = (state.prompt || "").trim() || "Summarize the key contents and findings of this PDF document.";
    const relevantdocs = await store.similaritySearch(query, 3);
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
2. Include only information necessary to answer the question. Do not include unnecessary additional details or loosely related facts from the context.
3. If the answer is a single fact, name, date, or number, provide a concise single-sentence or single-phrase response.
4. Every material factual claim in your answer must be supported by the context. Do not invent, infer, or extrapolate numbers, dates, policies, conditions, eligibility rules, or procedures.
5. If the context does not contain enough information to answer the question reliably, reply stating clearly that the information is not present in the document.

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
  } finally {
    if (state.file && state.file.path) {
      fs.unlink(state.file.path, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Failed to delete temp PDF file in pdfRagAgent:", unlinkErr.message);
        } else {
          console.log(`Successfully cleaned up temp PDF file: ${state.file.path}`);
        }
      });
    }
  }
};
