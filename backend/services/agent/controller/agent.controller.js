import axios from "axios";
import graph from "../graph/graph.js";
import { getModel } from "../config/model.js";

export const agent = async (req, res) => {
  try {
    const { prompt, conversationId, model, agent: selectedAgent } = req.body;
    console.log("req.body received in agent controller:", req.body);
    
    // chat history nikalne ke liye chat service ko call lagaya
    let history = [];
    if (conversationId) {
      try {
        const historyResponse = await axios.get(`${process.env.CHAT_SERVICE}/get-messages/${conversationId}`);
        history = historyResponse.data?.data || [];
      } catch (err) {
        console.error("Error fetching chat history from database:", err.message);
      }
    }

    // agar pehla message hai toh convo ka title automatic generate karo
    let titlePromise = null;
    if (conversationId && history.length === 0) {
      const llm = getModel("chatAgent");
      const titlePrompt = `Generate a very short, concise, 3-5 word title for a chat conversation starting with this user prompt: "${prompt}". Do not include quotes, markdown formatting, or any extra text. Reply with ONLY the title.`;
      
      titlePromise = llm.invoke(titlePrompt).then(async (response) => {
        const title = response.content.trim().replace(/['"`]/g, "");
        await axios.put(`${process.env.CHAT_SERVICE}/update-conversation`, {
          conversationId,
          title,
        });
        console.log(`Generated title for convo ${conversationId}: "${title}"`);
      }).catch(err => console.error("Error generating conversation title:", err.message));
    }

    // user ka chat message backend db me save karne ke liye call
    await axios.post(
      `${process.env.CHAT_SERVICE}/save-message`,
      {
        conversationId,
        role: "user",
        content: prompt,
      },
    ).catch(err => console.error("Error saving user message to database:", err.message));

    // server-sent events (SSE) headers set kar rahe hain taaki chunks stream ho sakein
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // LangGraph ke events suno aur token by token yield karo
    const stream = await graph.streamEvents(
      { prompt, conversationId, history, model, agent: selectedAgent },
      { version: "v2" }
    );

    for await (const event of stream) {
      if (event.event === "on_chat_model_stream" || event.event === "on_llm_stream") {
        // check taaki routing node ka inner log user screen par leak na ho
        if (event.metadata?.langgraph_node === "router") {
          continue;
        }
        const chunk = event.data.chunk;
        if (chunk?.content) {
          res.write(`data: ${JSON.stringify({ text: chunk.content })}\n\n`);
        }
      } else if (
        event.event === "on_chain_end" &&
        (event.name === "searchAgent" || event.metadata?.langgraph_node === "searchAgent")
      ) {
        const output = event.data.output;
        if (output && Array.isArray(output.images) && output.images.length > 0) {
          console.log("Streaming images from searchAgent:", output.images);
          res.write(`data: ${JSON.stringify({ images: output.images })}\n\n`);
        }
      } else if (event.event === "on_chain_end") {
        const output = event.data.output;
        // Image Agent complete hone par final output response ek hi baar me stream karein
        if (event.metadata?.langgraph_node === "imageAgent" && output) {
          if (output.aiResponse) {
            console.log("Streaming final imageAgent response:", output.aiResponse);
            res.write(`data: ${JSON.stringify({ text: output.aiResponse })}\n\n`);
          }
          if (output.images && Array.isArray(output.images) && output.images.length > 0) {
            console.log("Streaming images from imageAgent:", output.images);
            res.write(`data: ${JSON.stringify({ images: output.images })}\n\n`);
          }
        }
        if (output && Array.isArray(output.artifacts) && output.artifacts.length > 0) {
          console.log("Streaming artifacts:", output.artifacts);
          res.write(`data: ${JSON.stringify({ artifacts: output.artifacts })}\n\n`);
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
