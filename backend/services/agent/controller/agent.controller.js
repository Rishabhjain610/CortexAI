import fs from "fs";
import axios from "axios";
import graph from "../graph/graph.js";
import { getModel } from "../config/model.js";
import { router } from "../graph/router.js";

export const agent = async (req, res) => {
  try {
    const { prompt, conversationId, model, agent: selectedAgent } = req.body;
    const file = req.file;
    console.log("req.body received in agent controller:", req.body);

    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(400).json({ message: "User ID header is missing" });
    }

    // Sahi agent target identify karne ke liye router run kiya taaki custom credit cost map ho sake
    let targetAgent = selectedAgent;
    if (!targetAgent || targetAgent === "auto") {
      try {
        const routingResult = await router({ prompt, agent: selectedAgent, file });
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

    // Request processing se pehle user ke credit check aur deduct karne ke liye auth service call kiya
    try {
      const authServiceUrl = process.env.AUTH_SERVICE_URL;
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
          `${process.env.CHAT_SERVICE}/get-messages/${conversationId}`,
        );
        history = historyResponse.data?.data || [];
      } catch (err) {
        console.error(
          "Error fetching chat history from database:",
          err.message,
        );
      }
    }

    // agar pehla message hai toh Groq Qwen se title generate karo
    let titlePromise = null;
    if (conversationId && history.length === 0) {
      const llm = getModel("chatAgent"); 
      const titlePrompt = `Generate a very short, concise, 3-5 word title for a chat conversation starting with this user prompt: "${prompt}". Do not include quotes, markdown, or any extra text. Reply with ONLY the title.`;

      titlePromise = llm
        .invoke(titlePrompt)
        .then(async (response) => {
          let title = (response.content || "")
            .trim()
            .replace(/['"`]/g, "")
            .trim();
          if (!title)
            title = (prompt || "").trim().split(/\s+/).slice(0, 5).join(" ");
          title = title.charAt(0).toUpperCase() + title.slice(1);
          await axios.put(`${process.env.CHAT_SERVICE}/update-conversation`, {
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
      .post(`${process.env.CHAT_SERVICE}/save-message`, {
        conversationId,
        role: "user",
        content: savedContent,
        images: userImages,
      })
      .catch((err) =>
        console.error("Error saving user message to database:", err.message),
      );

    // server-sent events (SSE) headers set kar rahe hain taaki chunks stream ho sakein
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // LangGraph ke events suno aur token by token yield karo
    const stream = await graph.streamEvents(
      { prompt, conversationId, history, model, agent: selectedAgent, file },
      { version: "v2" },
    );

    // <think> block tracking — chatAgent aur pdfAgent dono ke liye shared flag
    let thinkingActive = false;

    for await (const event of stream) {
      if (
        event.event === "on_chat_model_stream" ||
        event.event === "on_llm_stream"
      ) {
        const node = event.metadata?.langgraph_node;
        if (node === "router") continue; // router tokens hamesha skip

        const chunk = event.data.chunk;
        const tokenText = chunk?.content || "";

        // chatAgent: Minimax (Ollama) uses no think tokens — stream directly
        if (node === "chatAgent") {
          if (tokenText)
            res.write(`data: ${JSON.stringify({ text: tokenText })}\n\n`);
          continue;
        }

        // pdfAgent aur pptAgent: sirf <think> block stream karo, JSON payload nahi
        if (node === "pdfAgent" || node === "pptAgent") {
          if (tokenText.includes("<think>")) {
            thinkingActive = true;
            continue;
          }
          if (tokenText.includes("</think>")) {
            thinkingActive = false;
            continue;
          }
          if (thinkingActive)
            res.write(`data: ${JSON.stringify({ text: tokenText })}\n\n`);
          continue;
        }

        // All other agents: direct stream
        if (tokenText) {
          res.write(`data: ${JSON.stringify({ text: tokenText })}\n\n`);
        }
      } else if (
        event.event === "on_chain_end" &&
        (event.name === "searchAgent" ||
          event.metadata?.langgraph_node === "searchAgent")
      ) {
        // searchAgent images — PDF/PPT request ke liye skip karo
        const output = event.data.output;
        if (
          output &&
          Array.isArray(output.images) &&
          output.images.length > 0
        ) {
          const cleanPrompt = (prompt || "").toLowerCase().trim();
          const pdfKeywords = ["file", "resume", "cv", "pdf", "document"];
          const pptKeywords = [
            "presentation",
            "ppt",
            "deck",
            "slideshow",
            "slide",
          ];
          const isPdfOrPpt =
            pdfKeywords.some((kw) => cleanPrompt.includes(kw)) ||
            pptKeywords.some((kw) => cleanPrompt.includes(kw)) ||
            selectedAgent === "pdfAgent" ||
            selectedAgent === "pptAgent";

          if (!isPdfOrPpt) {
            console.log("Streaming images from searchAgent:", output.images);
            res.write(`data: ${JSON.stringify({ images: output.images })}\n\n`);
          } else {
            console.log(
              "Skipping searchAgent image streaming because agent is PDF/PPT.",
            );
          }
        }
      } else if (event.event === "on_chain_end") {
        const output = event.data.output;
        const agentNode = event.metadata?.langgraph_node;

        // imageAgent / pdfAgent / pptAgent / pdfRagAgent — final response + pdf link + images
        if (
          (agentNode === "imageAgent" || agentNode === "pdfAgent" || agentNode === "pptAgent" || agentNode === "pdfRagAgent") &&
          output
        ) {
          if (output.aiResponse) {
            console.log(
              `Streaming final ${agentNode} response:`,
              output.aiResponse,
            );
            res.write(
              `data: ${JSON.stringify({ text: output.aiResponse })}\n\n`,
            );
          }
          if (
            output.images &&
            Array.isArray(output.images) &&
            output.images.length > 0
          ) {
            console.log(`Streaming images from ${agentNode}:`, output.images);
            res.write(`data: ${JSON.stringify({ images: output.images })}\n\n`);
          }
          if (output.pdf) {
            console.log(`Streaming pdf from ${agentNode}:`, output.pdf);
            res.write(`data: ${JSON.stringify({ pdf: output.pdf })}\n\n`);
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

    // title complete hone ka wait karo fir stream end karenge
    if (titlePromise) {
      try {
        await titlePromise;
      } catch (err) {
        console.error("Error awaiting title generation promise:", err.message);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Streaming error in agent controller:", error);
    res.write(`data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`);
    res.end();
  }
};
