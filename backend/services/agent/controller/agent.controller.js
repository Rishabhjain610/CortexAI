import axios from "axios";
import graph from "../graph/graph.js";
import { getModel } from "../config/model.js";

export const agent = async (req, res) => {
  try {
    const { prompt, conversationId, model, webSearch } = req.body;
    
    // Fetch chat history from chat service (if conversationId exists)
    let history = [];
    if (conversationId) {
      try {
        const historyResponse = await axios.get(`${process.env.CHAT_SERVICE}/get-messages/${conversationId}`);
        history = historyResponse.data?.data || [];
      } catch (err) {
        console.error("Error fetching chat history from database:", err.message);
      }
    }

    // Automatically generate conversation title if this is the first message
    if (conversationId && history.length === 0) {
      const llm = getModel("chatAgent");
      const titlePrompt = `Generate a very short, concise, 3-5 word title for a chat conversation starting with this user prompt: "${prompt}". Do not include quotes, markdown formatting, or any extra text. Reply with ONLY the title.`;
      
      // Asynchronous call so we don't delay SSE stream initialization
      llm.invoke(titlePrompt).then(async (response) => {
        const title = response.content.trim().replace(/['"`]/g, "");
        await axios.put(`${process.env.CHAT_SERVICE}/update-conversation`, {
          conversationId,
          title,
        });
        console.log(`Generated title for convo ${conversationId}: "${title}"`);
      }).catch(err => console.error("Error generating conversation title:", err.message));
    }

    // Save user message to chat service (runs in background)
    await axios.post(
      `${process.env.CHAT_SERVICE}/save-message`,
      {
        conversationId,
        role: "user",
        content: prompt,
      },
    ).catch(err => console.error("Error saving user message to database:", err.message));

    // Set streaming headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Stream LangGraph events (capturing token-by-token LLM output)
    const stream = await graph.streamEvents(
      { prompt, conversationId, history, model, webSearch },
      { version: "v2" }
    );

    for await (const event of stream) {
      if (event.event === "on_chat_model_stream" || event.event === "on_llm_stream") {
        const chunk = event.data.chunk;
        if (chunk?.content) {
          res.write(`data: ${JSON.stringify({ text: chunk.content })}\n\n`);
        }
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

