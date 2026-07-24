import { Queue, Worker, QueueEvents } from "bullmq";
import { bullRedisConnection } from "../config/bullmq.js";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { vectorStore } from "../config/vectorDB.js";
import redis from "../../../shared/redis/redis.js";
import { pdfAgent } from "../agents/pdf.agents.js";
import { pptAgent } from "../agents/ppt.agents.js";

// ===================================================================================
// BullMQ Queues & Workers — Asynchronous Heavy Agent Processing
// ===================================================================================

// 1. Queue Definitions
export const pdfRagQueue = new Queue("pdf-rag-queue", {
  connection: bullRedisConnection,
});
export const pptGenQueue = new Queue("ppt-gen-queue", {
  connection: bullRedisConnection,
});
export const pdfGenQueue = new Queue("pdf-gen-queue", {
  connection: bullRedisConnection,
});
export const pdfRagQueueEvents = new QueueEvents("pdf-rag-queue", {
  connection: bullRedisConnection,
});

// -----------------------------------------------------------------------------------
// Worker 1: PDF Upload & RAG Vector Indexing Worker
// -----------------------------------------------------------------------------------
export const pdfRagWorker = new Worker(
  "pdf-rag-queue",
  async (job) => {
    // [BullMQ Execution] Worker picked up PDF RAG job from Redis queue
    console.log(
      `\n======================================================================`,
    );
    console.log(
      `[BullMQ Worker: PDF-RAG] 🚀 STARTED Processing Job #${job.id}`,
    );
    console.log(
      `[BullMQ Queue] Queue: pdf-rag-queue | File: ${job.data.filePath}`,
    );
    console.log(
      `======================================================================\n`,
    );

    const { filePath, conversationId, prompt } = job.data;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    let text = "";
    try {
      // PDFParse v2 is a CLASS — instantiate with { data: buffer }, then call load() before getText()
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const textResult = await parser.getText();
      text = textResult.text || "";
      console.log(`[BullMQ Worker: PDF-RAG] ✅ PDF parsed successfully. Raw text: ${text.length} chars.`);
    } catch (parseErr) {
      throw new Error(`PDF text parsing failed: ${parseErr.message}`);
    }

    const cleanedText = text
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1200,
      chunkOverlap: 250,
    });
    const allDocs = await splitter.createDocuments([cleanedText]);
    const docs = allDocs.filter((d) => d.pageContent.trim().length > 30);

    const collectionName = `pdf-${Date.now()}`;
    console.log(
      `[BullMQ Worker: PDF-RAG] 📦 Embedding ${docs.length} text chunks into Qdrant collection: ${collectionName}`,
    );
    const store = await vectorStore(
      docs.length > 0 ? docs : allDocs,
      collectionName,
    );

    if (conversationId) {
      await redis.set(
        `pdf:collection:${conversationId}`,
        collectionName,
        "EX",
        2 * 60 * 60,
      );
    }

    const query =
      (prompt || "").trim() || "Summarize the key contents and findings of this PDF document.";
    const relevantDocs = await store.similaritySearch(query, 10);

    // Remove local temp uploaded file after indexing completes
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
      console.warn("Failed to remove temp file:", e.message);
    }

    // Call LLM model to generate AI response from RAG context in background worker
    let aiResponse = "";
    try {
      const context = relevantDocs.map((d) => d.pageContent).join("\n\n");
      const { getModel } = await import("../config/model.js");
      const { SystemMessage, HumanMessage } = await import("@langchain/core/messages");
      const llm = getModel("pdfRagAgent");

      const messages = [
        new SystemMessage(
          `You are CortexAI, an expert PDF document analysis assistant. The user uploaded a PDF document (processed via BullMQ background queue).

CRITICAL RULES — READ CAREFULLY:
- Answer the user's question using ONLY the text provided in the Context section below.
- If the user asks "what is this" or "summarize this", describe and summarize the document content from the Context.
- Every factual claim must be supported by the Context.

Context (extracted text from the uploaded PDF document):
${context}`,
        ),
        new HumanMessage(query),
      ];

      const response = await llm.invoke(messages);
      aiResponse = response.content || "";
    } catch (llmErr) {
      console.error("[BullMQ Worker: PDF-RAG] LLM generation failed:", llmErr.message);
      aiResponse = `PDF indexed successfully into collection '${collectionName}'. (LLM summary generation failed: ${llmErr.message})`;
    }

    console.log(
      `\n[BullMQ Worker: PDF-RAG] ✅ COMPLETED Job #${job.id} | Collection: ${collectionName}\n`,
    );

    return {
      status: "completed",
      collectionName,
      totalChunks: docs.length,
      relevantDocsCount: relevantDocs.length,
      aiResponse,
      sampleContent: relevantDocs.slice(0, 2).map((d) => d.pageContent),
    };
  },
  { connection: bullRedisConnection, concurrency: 3 },
);

// -----------------------------------------------------------------------------------
// Worker 2: PowerPoint (.pptx) Slide Generation Worker
// -----------------------------------------------------------------------------------
export const pptGenWorker = new Worker(
  "ppt-gen-queue",
  async (job) => {
    // [BullMQ Execution] Worker picked up PPT generation job from Redis queue
    console.log(
      `\n======================================================================`,
    );
    console.log(
      `[BullMQ Worker: PPT-GEN] 🚀 STARTED Processing Job #${job.id}`,
    );
    console.log(
      `[BullMQ Queue] Queue: ppt-gen-queue | Prompt: "${job.data.prompt}"`,
    );
    console.log(
      `======================================================================\n`,
    );

    const { prompt, searchResults, images } = job.data;

    const state = { prompt, searchResults, images };
    const result = await pptAgent(state);

    if (!result || !result.downloadUrl) {
      throw new Error("PPT generation failed to produce an S3 download URL.");
    }

    console.log(
      `\n[BullMQ Worker: PPT-GEN] ✅ COMPLETED Job #${job.id} | Download URL: ${result.downloadUrl}\n`,
    );

    return {
      status: "completed",
      downloadUrl: result.downloadUrl,
      fileName: result.fileName || "presentation.pptx",
      aiResponse: result.aiResponse,
    };
  },
  { connection: bullRedisConnection, concurrency: 2 },
);

// -----------------------------------------------------------------------------------
// Worker 3: PDF Document Report Generation Worker
// -----------------------------------------------------------------------------------
export const pdfGenWorker = new Worker(
  "pdf-gen-queue",
  async (job) => {
    // [BullMQ Execution] Worker picked up PDF generation job from Redis queue
    console.log(
      `\n======================================================================`,
    );
    console.log(
      `[BullMQ Worker: PDF-GEN] 🚀 STARTED Processing Job #${job.id}`,
    );
    console.log(
      `[BullMQ Queue] Queue: pdf-gen-queue | Prompt: "${job.data.prompt}"`,
    );
    console.log(
      `======================================================================\n`,
    );

    const { prompt, searchResults, images } = job.data;

    const state = { prompt, searchResults, images };
    const result = await pdfAgent(state);

    if (!result || !result.downloadUrl) {
      throw new Error("PDF generation failed to produce an S3 download URL.");
    }

    console.log(
      `\n[BullMQ Worker: PDF-GEN] ✅ COMPLETED Job #${job.id} | Download URL: ${result.downloadUrl}\n`,
    );

    return {
      status: "completed",
      downloadUrl: result.downloadUrl,
      fileName: result.fileName || "document.pdf",
      aiResponse: result.aiResponse,
    };
  },
  { connection: bullRedisConnection, concurrency: 2 },
);

// Event Listeners for Queue Debugging & Console Visibility
[
  { worker: pdfRagWorker, queueName: "pdf-rag-queue" },
  { worker: pptGenWorker, queueName: "ppt-gen-queue" },
  { worker: pdfGenWorker, queueName: "pdf-gen-queue" },
].forEach(({ worker, queueName }) => {
  worker.on("completed", (job) => {
    console.log(
      `[BullMQ Event] 🎉 Job #${job.id} in queue '${queueName}' has COMPLETED.`,
    );
  });
  worker.on("failed", (job, err) => {
    console.error(
      `[BullMQ Event] ❌ Job #${job?.id} in queue '${queueName}' FAILED: ${err.message}`,
    );
  });
  worker.on("active", (job) => {
    console.log(
      `[BullMQ Event] ⚡ Job #${job.id} in queue '${queueName}' is now ACTIVE.`,
    );
  });
});
