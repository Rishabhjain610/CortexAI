import fs from "fs";
import axios from "axios";
import graph from "../graph/graph.js";
import { getModel } from "../config/model.js";
import { router } from "../graph/router.js";

// Agent Controller — Frontend se aaye AI request ko process karne wala main handler.
// SSE (Server-Sent Events) stream open karke token-by-token response frontend tak bhejta hai.
export const agent = async (req, res) => {
  try {
    const { prompt, conversationId, model, agent: selectedAgent } = req.body;
    const file = req.file; // Multer middleware se parsed uploaded file (agar koi file attach hui ho)
    console.log("req.body received in agent controller:", req.body);
    if (process.env.BENCH_MODE === "1") {
      console.log(`[BENCH_TRACE] [agentController] User: ${req.headers["x-user-id"] || "anon"} | Target: ${selectedAgent || "auto"} | Prompt: "${(req.body.prompt || "").slice(0, 50)}"`);
    }

    // x-user-id header Gateway ke proxyWithHeader utility ne inject kiya hota hai authenticated sessions ke liye
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(400).json({ message: "User ID header is missing" });
    }

    // Sahi agent target identify karne ke liye router run kiya taaki custom credit cost map ho sake
    let targetAgent = selectedAgent;
    if (!targetAgent || targetAgent === "auto") {
      try {
        const routingResult = await router({ prompt, agent: selectedAgent, file, conversationId });
        targetAgent = routingResult.agent;
      } catch (routingErr) {
        console.error("Failed to pre-determine routing for credit check:", routingErr.message);
        targetAgent = "chatAgent";
      }
    }

    // Agent-wise credits deduction costing definitions
    const CREDIT_COST_MAP = {
      chatAgent: 1,
      searchAgent: 5,
      codingAgent: 10,
      pdfAgent: 10,
      pptAgent: 10,
      pdfRagAgent: 10,
      imageAnalyzer: 10,
    };
    const cost = CREDIT_COST_MAP[targetAgent] || 1;

    const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
    const chatServiceUrl = process.env.CHAT_SERVICE || process.env.CHAT_SERVICE_URL || "http://localhost:8002";

    // Request processing se pehle user ke credit check aur deduct karne ke liye auth service call kiya
    try {
      await axios.post(`${authServiceUrl}/deduct-credit`, { userId, amount: cost });
    } catch (err) {
      console.error("Credit deduction verification failed:", err.response?.data || err.message);
      if (err.response && err.response.status === 403) {
        return res.status(403).json({
          message: err.response.data?.message || "Insufficient credits.",
          credits: 0,
        });
      }
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ message: "User not found." });
      }
      // Fallback logic: agar auth service temporarily down hai toh operation allow karo aur warning print karo
    }

    // chat history nikalne ke liye chat service ko call lagaya
    let history = [];
    if (conversationId) {
      try {
        const historyResponse = await axios.get(
          `${chatServiceUrl}/get-messages/${conversationId}`,
        );
        history = historyResponse.data?.data || [];
      } catch (err) {
        console.error(
          "Error fetching chat history from database:",
          err.message,
        );
      }
    }

    // Agar pehla message hai (history empty) toh conversation title auto-generate karo.
    // titlePromise — Fire-and-forget pattern: Title generate karna SSE stream ke parallel chal sakta hai.
    // await nahi kiya abhi — stream end hone se pehle title ban jaye ya na jaye, user ko wait nahi karwana.
    // Stream complete hone ke baad (res.write("[DONE]") se pehle) titlePromise await karenge.
    let titlePromise = null;
    if (conversationId && history.length === 0) {
      const llm = getModel("chatAgent"); 
      const titlePrompt = `Generate a very short, concise, 3-5 word title for a chat conversation starting with this user prompt: "${prompt}". Do not include quotes, markdown, or any extra text. Reply with ONLY the title.`;

      titlePromise = llm
        .invoke(titlePrompt)
        .then(async (response) => {
          let title = (response.content || "")
            .trim()
            .replace(/['"`]/g, "") // LLM kabhi kabhi title quotes me wrap karta hai, usse hataate hain
            .trim();
          // Agar LLM ne khaali title diya toh fallback — prompt ke pehle 5 words use karo
          if (!title)
            title = (prompt || "").trim().split(/\s+/).slice(0, 5).join(" ");
          // Pehla letter capital karo — polish presentation ke liye
          title = title.charAt(0).toUpperCase() + title.slice(1);
          await axios.put(`${chatServiceUrl}/update-conversation`, {
            conversationId,
            title,
          });
          console.log(
            `Generated title for convo ${conversationId}: "${title}"`,
          );
        })
        .catch((err) =>
          console.error("Error generating conversation title:", err.message),
        );
    }

    // user uploaded image check karke base64 url format banaya
    let userImages = [];
    if (file && file.mimetype?.startsWith("image/") && file.path) {
      try {
        const b64 = fs.readFileSync(file.path, { encoding: "base64" });
        userImages = [`data:${file.mimetype};base64,${b64}`];
      } catch (e) {
        console.error("Failed to read image for user message save:", e.message);
      }
    }

    // user uploaded file attachment badge format
    let savedContent = prompt;
    if (file && file.originalname) {
      const fileIcon = file.mimetype?.startsWith("image/") ? "🖼️" : "📄";
      savedContent = prompt ? `${prompt}\n\n[Attached: ${fileIcon} ${file.originalname}]` : `${fileIcon} ${file.originalname}`;
    }

    // user ka chat message backend db me save karne ke liye call
    await axios
      .post(`${chatServiceUrl}/save-message`, {
        conversationId,
        role: "user",
        content: savedContent,
        images: userImages,
      })
      .catch((err) =>
        console.error("Error saving user message to database:", err.message),
      );

    // ─────────────────────────────────────────────────────────────────────────
    // 10MB+ PDF AUTO-QUEUE: PDFs > 10MB are routed to BullMQ pdf-rag-queue.
    // The BullMQ worker processes parsing, text-splitting, Qdrant embedding,
    // and LLM RAG response generation in the queue worker.
    // The controller waits for job completion, streams the AI answer, and finishes.
    // ─────────────────────────────────────────────────────────────────────────
    const PDF_QUEUE_THRESHOLD_BYTES = 10 * 1024 * 1024; // 10 MB
    const isPdfFile = file && (
      file.mimetype === "application/pdf" ||
      (file.originalname || "").toLowerCase().endsWith(".pdf")
    );

    if (isPdfFile && file.size > PDF_QUEUE_THRESHOLD_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      console.log(
        `[BullMQ Auto-Queue] 📦 Large PDF detected (${fileSizeMB} MB > 10 MB). ` +
        `Enqueuing '${file.originalname}' to BullMQ pdf-rag-queue.`
      );

      const { pdfRagQueue, pdfRagQueueEvents } = await import("../queues/agentQueues.js");
      const job = await pdfRagQueue.add("pdf-rag-ingest", {
        filePath: file.path,
        conversationId: conversationId || null,
        prompt: prompt || "",
        userId,
      }, {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      });

      req.isQueued = true; // Prevents finally block from unlinking temp file before worker finishes

      // Open SSE stream
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Wait for the BullMQ worker to finish processing and return the RAG answer
      try {
        const result = await job.waitUntilFinished(pdfRagQueueEvents);
        if (result && result.aiResponse) {
          console.log(`[BullMQ Auto-Queue] Streaming AI response for Job #${job.id}:`, result.aiResponse.slice(0, 100) + "...");
          res.write(`data: ${JSON.stringify({ text: result.aiResponse })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ text: "PDF processed successfully in background queue." })}\n\n`);
        }
      } catch (queueErr) {
        console.error(`[BullMQ Auto-Queue] Job #${job.id} failed:`, queueErr.message);
        res.write(`data: ${JSON.stringify({ text: `Failed to process PDF in background queue: ${queueErr.message}` })}\n\n`);
      }

      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // SSE (Server-Sent Events) headers — browser ko batate hain ki yeh connection chunked streaming hai.
    // Content-Type: text/event-stream — browser is format ko samajhta hai aur data: {...} lines parse karta hai.
    // Cache-Control: no-cache — proxies ya CDN ko stream cache nahi karni chahiye.
    // Connection: keep-alive — TCP connection stream ke dauran open rakho, close mat karo.
    // X-Accel-Buffering: no — Nginx reverse proxy ke liye: response buffer mat karo, turant forward karo.
    // flushHeaders() — Headers turant bhejo taaki browser streaming mode me aa jaye, body wait nahi kare.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // LangGraph graph.streamEvents — v2 protocol use karo, har node event emit karta hai (on_chat_model_stream, on_chain_end etc.)
    const stream = await graph.streamEvents(
      { prompt, conversationId, history, model, agent: selectedAgent, file },
      { version: "v2" },
    );


    // thinkingActive flag — pdfAgent/pptAgent ke <think>...</think> block ko track karta hai.
    // Qwen model apna internal reasoning <think> tags me wrap karta hai — yeh frontend ThoughtBox me dikhata hai.
    // pdfAgent/pptAgent ke liye sirf thinking content stream karo, baaki JSON payload nahi (wo on_chain_end me aata hai).
    let thinkingActive = false;

    // Dedup flags — LangGraph emits multiple on_chain_end events as output propagates up through nested chain wrappers.
    // Each flag locks after the FIRST aiResponse write so duplicates are silently ignored.
    // Using booleans (not a Set keyed by agentNode) because wrapper events often have langgraph_node = undefined
    // but still carry the full output, bypassing a Set guard keyed on the node name.
    let pdfRagResponded = false;
    let imageAgentResponded = false;
    let pdfAgentResponded = false;
    let pptAgentResponded = false;

    for await (const event of stream) {
      if (event.event === "on_chat_model_stream") {
        const node = event.metadata?.langgraph_node;
        const chunk = event.data.chunk;
        const tokenText = chunk?.content || "";

        // Router node, pdfRagAgent, and imageAgent tokens should NOT be streamed token-by-token.
        if (!node || node === "router" || node === "pdfRagAgent" || node === "imageAgent") continue;

        // chatAgent (Ollama Minimax) — direct token-by-token stream
        if (node === "chatAgent" || node === "codingAgent" || node === "searchAgent") {
          if (tokenText)
            res.write(`data: ${JSON.stringify({ text: tokenText })}\n\n`);
          continue;
        }

        // pdfAgent / pptAgent — JSON payload token-by-token stream mat karo (garbage text dikhega).
        // Sirf <think> block stream karo taaki ThoughtBox me reasoning dikhe.
        // Actual JSON response on_chain_end event me complete milta hai — wahan se stream karenge.
        if (node === "pdfAgent" || node === "pptAgent") {
          if (tokenText.includes("<think>")) {
            thinkingActive = true; // thinking block shuru — aage ke tokens ThoughtBox ke liye bhejo
            continue;
          }
          if (tokenText.includes("</think>")) {
            thinkingActive = false; // thinking block khatam — aage ke tokens ignore karo
            continue;
          }
          if (thinkingActive)
            res.write(`data: ${JSON.stringify({ text: tokenText })}\n\n`);
          continue;
        }
      } else if (event.event === "on_chain_end") {
        const output = event.data.output;
        // event.name = the exact runnable that fired (e.g. "pdfRagAgent", "LangGraph", "RunnableLambda")
        // event.metadata.langgraph_node = the graph node containing the runnable
        // Only emit when BOTH match the same agent name — this eliminates all wrapper chain duplicates.
        const eventName = event.name;
        const agentNode = event.metadata?.langgraph_node;

        // pdfRagAgent — final answer from PDF RAG pipeline. Stream exactly once.
        if (
          eventName === "pdfRagAgent" &&
          agentNode === "pdfRagAgent" &&
          output?.aiResponse &&
          !pdfRagResponded
        ) {
          pdfRagResponded = true;
          console.log(`Streaming final pdfRagAgent response:`, output.aiResponse);
          res.write(`data: ${JSON.stringify({ text: output.aiResponse })}\n\n`);
        }

        // imageAgent — final image response. Stream exactly once.
        if (
          eventName === "imageAgent" &&
          agentNode === "imageAgent" &&
          output?.aiResponse &&
          !imageAgentResponded
        ) {
          imageAgentResponded = true;
          console.log(`Streaming final imageAgent response:`, output.aiResponse);
          res.write(`data: ${JSON.stringify({ text: output.aiResponse })}\n\n`);
        }

        // imageAgent images array (only from the actual agent, not wrappers)
        if (
          eventName === "imageAgent" &&
          agentNode === "imageAgent" &&
          Array.isArray(output?.images) &&
          output.images.length > 0
        ) {
          console.log(`Streaming images from imageAgent:`, output.images);
          res.write(`data: ${JSON.stringify({ images: output.images })}\n\n`);
        }

        // pdfAgent — generated PDF download link. Stream exactly once.
        if (
          eventName === "pdfAgent" &&
          agentNode === "pdfAgent" &&
          output &&
          !pdfAgentResponded
        ) {
          if (output.aiResponse) {
            pdfAgentResponded = true;
            console.log(`Streaming final pdfAgent response:`, output.aiResponse);
            res.write(`data: ${JSON.stringify({ text: output.aiResponse })}\n\n`);
          }
          if (output.pdf) {
            console.log(`Streaming pdf from pdfAgent:`, output.pdf);
            res.write(`data: ${JSON.stringify({ pdf: output.pdf })}\n\n`);
          }
        }

        // pptAgent — generated PPT download link. Stream exactly once.
        if (
          eventName === "pptAgent" &&
          agentNode === "pptAgent" &&
          output &&
          !pptAgentResponded
        ) {
          if (output.aiResponse) {
            pptAgentResponded = true;
            console.log(`Streaming final pptAgent response:`, output.aiResponse);
            res.write(`data: ${JSON.stringify({ text: output.aiResponse })}\n\n`);
          }
          if (output.pdf) {
            console.log(`Streaming pdf from pptAgent:`, output.pdf);
            res.write(`data: ${JSON.stringify({ pdf: output.pdf })}\n\n`);
          }
        }

        // searchAgent images (only from the actual searchAgent, not after routing to pdfAgent/pptAgent)
        if (
          (eventName === "searchAgent" || agentNode === "searchAgent") &&
          Array.isArray(output?.images) &&
          output.images.length > 0
        ) {
          const cleanPrompt = (prompt || "").toLowerCase().trim();
          const pdfKeywords = ["file", "resume", "cv", "pdf", "document"];
          const pptKeywords = ["presentation", "ppt", "deck", "slideshow", "slide"];
          const isPdfOrPpt =
            pdfKeywords.some((kw) => cleanPrompt.includes(kw)) ||
            pptKeywords.some((kw) => cleanPrompt.includes(kw)) ||
            selectedAgent === "pdfAgent" ||
            selectedAgent === "pptAgent";
          if (!isPdfOrPpt) {
            console.log("Streaming images from searchAgent:", output.images);
            res.write(`data: ${JSON.stringify({ images: output.images })}\n\n`);
          }
        }

        // Artifacts (codingAgent output etc.)
        if (
          output &&
          Array.isArray(output.artifacts) &&
          output.artifacts.length > 0
        ) {
          console.log("Streaming artifacts:", output.artifacts);
          res.write(
            `data: ${JSON.stringify({ artifacts: output.artifacts })}\n\n`,
          );
        }
      }
    }

    // Stream khatam hone se pehle title generation promise ka wait karo.
    // Agar title pehle hi complete ho gaya ho toh yeh instantly resolve hoga.
    // Agar abhi bhi pending ho toh wait karo — sidebar me galat title nahi chahiye.
    if (titlePromise) {
      try {
        await titlePromise;
      } catch (err) {
        console.error("Error awaiting title generation promise:", err.message);
      }
    }

    // [DONE] signal bhejo — frontend ko batao ki stream complete ho gaya hai aur connection close kar sakte ho.
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Streaming error in agent controller:", error);
    res.write(`data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`);
    res.end();
  } finally {
    if (req.file && req.file.path && !req.isQueued) {
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error("Failed to delete temp uploaded file in agent controller finally:", err.message);
        } else {
          console.log(`Successfully cleaned up temp uploaded file: ${req.file.path}`);
        }
      });
    }
  }
};

// ===================================================================================
// BullMQ Async Background Controllers (PDF RAG, PPT Gen, PDF Gen)
// ===================================================================================
import { pdfRagQueue, pptGenQueue, pdfGenQueue } from "../queues/agentQueues.js";

// 1. Enqueue PDF RAG Indexing Job
export const enqueuePdfRag = async (req, res) => {
  try {
    const { prompt, conversationId } = req.body;
    const file = req.file;

    if (!file || !file.path) {
      return res.status(400).json({ message: "No PDF file attached for RAG indexing." });
    }

    const job = await pdfRagQueue.add("pdf-rag-ingest", {
      filePath: file.path,
      conversationId: conversationId || null,
      prompt: prompt || "",
      userId: req.headers["x-user-id"] || "anonymous",
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });

    // [BullMQ Producer Log] Print console alert when PDF RAG job is added to Redis queue
    console.log(`[BullMQ Producer] 📥 Job #${job.id} successfully queued into 'pdf-rag-queue' for file: ${file.path}`);

    return res.status(202).json({
      success: true,
      message: "PDF RAG indexing job queued successfully",
      jobId: job.id,
      queue: "pdf-rag-queue",
    });
  } catch (err) {
    console.error("Error enqueuing PDF RAG job:", err);
    return res.status(500).json({ message: "Failed to queue PDF RAG job", error: err.message });
  }
};

// 2. Enqueue PPT Generation Job
export const enqueuePptGen = async (req, res) => {
  try {
    const { prompt, searchResults, images } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required for PPT generation." });
    }

    const job = await pptGenQueue.add("ppt-generate", {
      prompt,
      searchResults: searchResults || [],
      images: images || [],
      userId: req.headers["x-user-id"] || "anonymous",
    }, {
      attempts: 2,
      backoff: { type: "exponential", delay: 3000 },
    });

    // [BullMQ Producer Log] Print console alert when PPT generation job is added to Redis queue
    console.log(`[BullMQ Producer] 📥 Job #${job.id} successfully queued into 'ppt-gen-queue' for prompt: "${prompt}"`);

    return res.status(202).json({
      success: true,
      message: "PPT presentation generation job queued successfully",
      jobId: job.id,
      queue: "ppt-gen-queue",
    });
  } catch (err) {
    console.error("Error enqueuing PPT job:", err);
    return res.status(500).json({ message: "Failed to queue PPT generation job", error: err.message });
  }
};

// 3. Enqueue PDF Generation Job
export const enqueuePdfGen = async (req, res) => {
  try {
    const { prompt, searchResults, images } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required for PDF document generation." });
    }

    const job = await pdfGenQueue.add("pdf-generate", {
      prompt,
      searchResults: searchResults || [],
      images: images || [],
      userId: req.headers["x-user-id"] || "anonymous",
    }, {
      attempts: 2,
      backoff: { type: "exponential", delay: 3000 },
    });

    // [BullMQ Producer Log] Print console alert when PDF document generation job is added to Redis queue
    console.log(`[BullMQ Producer] 📥 Job #${job.id} successfully queued into 'pdf-gen-queue' for prompt: "${prompt}"`);

    return res.status(202).json({
      success: true,
      message: "PDF document generation job queued successfully",
      jobId: job.id,
      queue: "pdf-gen-queue",
    });
  } catch (err) {
    console.error("Error enqueuing PDF job:", err);
    return res.status(500).json({ message: "Failed to queue PDF generation job", error: err.message });
  }
};

// 4. Poll Job Status
export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Search across the three queues
    const queues = [pdfRagQueue, pptGenQueue, pdfGenQueue];
    let foundJob = null;

    for (const queue of queues) {
      const job = await queue.getJob(jobId);
      if (job) {
        foundJob = job;
        break;
      }
    }

    if (!foundJob) {
      return res.status(404).json({ message: `Job with ID '${jobId}' not found.` });
    }

    const state = await foundJob.getState();
    const result = foundJob.returnvalue || null;
    const failedReason = foundJob.failedReason || null;

    // [BullMQ Poller Log] Print console log whenever a client polls for job status
    console.log(`[BullMQ Poller] 🔍 Polled Job #${foundJob.id} | State: '${state}' | Progress: ${foundJob.progress}%`);

    return res.status(200).json({
      success: true,
      jobId: foundJob.id,
      state, // "waiting", "active", "completed", "failed"
      progress: foundJob.progress,
      result,
      failedReason,
    });
  } catch (err) {
    console.error("Error getting BullMQ job status:", err);
    return res.status(500).json({ message: "Failed to fetch job status", error: err.message });
  }
};

