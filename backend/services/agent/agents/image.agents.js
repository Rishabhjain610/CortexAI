import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";
import axios from "axios";
import { uploadToS3 } from "../utils/uploadToS3.js";

// Image Agent Node: Graphic generation aur image prompt design/enhancement ke liye core logic.
export const imageAgent = async (state) => {
  console.log("--- IMAGE AGENT ---");
  
  // config/model.js se imageAgent config fetch kar rahe hain
  const llm = getModel("imageAgent");
  
  // Prompt expansion ke liye detailed system message rules set kiya
  const systemPrompt = `You are a professional AI Image Prompt Engineer.
Your job is to take a simple image description from the user and expand it into a detailed, descriptive prompt optimized for AI image generators (like Midjourney, Stable Diffusion, or DALL-E).

Expanse Rules:
- Add vivid details: subject appearance, action, setting/background, lighting (e.g. cinematic, dramatic, soft volumetric), camera angle, colors, and mood.
- Inject high-quality prompt enhancement suffixes where suitable, such as "8k resolution, photorealistic, highly detailed, cinematic lighting, masterpiece, hyper-realistic, DSLR, 85mm lens, f/1.8".
- Avoid generating split views, multiple angles, grid panels, side photos, sheets, or collages. The prompt MUST describe a SINGLE, unified photograph or illustration.
- Keep it descriptive but concise.
- Output ONLY the final expanded prompt. Do not write any conversational text, explanations, or quotes.
- Do NOT wrap the prompt in code blocks (like \`\`\` or \`\`\`text). Do NOT output any "Here is the expanded prompt" text. Respond with the plain text prompt only.`;

  // System aur Human message compile karke messages array build kar rahe hain
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(state.prompt),
  ];

  // Invoke model to get the enhanced prompt (without streaming tokens)
  const response = await llm.invoke(messages);
  const enhancedPrompt = response.content.trim();

  // Pollinations AI image generator URL setup kar rahe hain with the enhanced prompt
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}`;
  
  // Image download fetch query trigger to S3 buffer
  const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(imageResponse.data);
  const filename = `image-${Date.now()}.png`;
  
  // S3 par upload complete aur direct download URL return karwa rahe hain
  const downloadUrl = await uploadToS3(filename, buffer, 'image/png');
  console.log("Generated S3 Image URL:", downloadUrl);

  // output me LLM source information include check so user can see it
  const llmInfo = `[LLM Called: Groq (Qwen-3.6-27b) for Image Prompt Enhancement. Image generated and saved to S3.]`;
  console.log(`Image Agent executed: ${llmInfo}`);

  return {
    aiResponse: `<think>${llmInfo}</think>`,
    images: [downloadUrl],
  };
};