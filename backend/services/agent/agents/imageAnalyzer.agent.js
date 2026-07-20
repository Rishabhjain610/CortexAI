import fs from "fs";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";

// Groq Qwen Vision model ko call lagakar uploaded image analyze karne wala main assistant node
export const imageAnalyzer = async (state) => {
  console.log("--- IMAGE ANALYZER AGENT ---");
  const { prompt, file } = state;

  // Agar request me file nahi aayi hai toh error message return do
  if (!file) {
    return {
      aiResponse: "No image file was uploaded for analysis."
    };
  }

  // Model dispatcher se Groq Vision LLM load kar rahe hain
  const llm = getModel("imageAnalyzer");

  // Disk se uploaded file ko Base64 string format me encode kar rahe hain
  let base64Image;
  try {
    base64Image = fs.readFileSync(file.path, { encoding: "base64" });
  } catch (readErr) {
    console.error("Failed to read uploaded image file:", readErr);
    return {
      aiResponse: "Failed to read the uploaded image file for analysis."
    };
  }

  // System instruction set kar rahe hain vision output ke liye
  const systemMessage = new SystemMessage(
    "You are CortexAI, an expert vision AI. You analyze the provided image and answer the user's questions with maximum detail, clarity, and precision."
  );

  // OpenAI-compatible multimodal HumanMessage format build kar rahe hain
  const humanMessage = new HumanMessage({
    content: [
      { type: "text", text: prompt || "Describe what you see in this image in detail." },
      {
        type: "image_url",
        image_url: {
          url: `data:${file.mimetype || "image/png"};base64,${base64Image}`
        }
      }
    ]
  });

  const messages = [systemMessage, humanMessage];

  let content = "";
  try {
    const stream = await llm.stream(messages);
    for await (const chunk of stream) {
      content += chunk.content;
    }
  } catch (err) {
    console.error("Image analysis stream failed:", err);
    try {
      const response = await llm.invoke(messages);
      content = response.content || "";
    } catch (invokeErr) {
      console.error("Image analysis invoke failed:", invokeErr);
      content = "Sorry, an error occurred while analyzing the image.";
    }
  } finally {
    // Delete temp file asynchronously to prevent blocking response and cleanup disk space
    fs.unlink(file.path, (unlinkErr) => {
      if (unlinkErr) {
        console.error("Failed to delete temp file in imageAnalyzer:", unlinkErr.message);
      } else {
        console.log(`Successfully cleaned up temp file: ${file.path}`);
      }
    });
  }

  // <think> block formatting check for frontend ThoughtBox rendering
  let finalResponse = content;
  if (finalResponse.includes("<think>") && !finalResponse.includes("</think>")) {
    finalResponse += "\n</think>\n";
  }

  return {
    aiResponse: finalResponse
  };
};