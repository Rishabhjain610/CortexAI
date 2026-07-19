import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";
import { getModel } from "../config/model.js";

// Chat agent node function: General queries aur conversations ko manage karne wala core agent hook.
export const chatAgent = async (state) => {
  console.log("--- CHAT AGENT ---");

  const llm = getModel("chatAgent");
  const now = new Date();
  const currentDateTimeString = now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    timeZoneName: "short",
  });

  let systemPrompt = `You are CortexAI, an intelligent AI assistant created by Rishabh Jain.
Current system time and date: ${currentDateTimeString}.
Use this current time as reference when answering time-sensitive questions (like 'current time', 'today', 'yesterday', etc.).

Safety & SFW Guardrails:
1. Always maintain a strictly professional, clean, and safe-for-work (SFW) tone.
2. Do not generate sexually explicit language, adult industry jargon, or links/references to adult websites (e.g. Pornhub, XVideos, XNXX).
3. If the search context contains adult or explicit material, filter it out completely. Focus only on mainstream, encyclopedic biographical facts (such as date of birth, birthplace, general career timeline, and general achievements) without explicit details.`;


  // Default userContent user ka original prompt hi rahega
  let userContent = state.prompt;

  // Agar search results available hain toh use user prompt ke saath inject karte hain taaki assistant context read kar sake.
  if (state.searchResults) {
    const formattedResults = Array.isArray(state.searchResults)
      ? state.searchResults
          .map(
            (res, i) =>
              `[${i + 1}] Title: ${res.title}\nURL: ${res.url}\nContent: ${res.content}`,
          )
          .join("\n\n")
      : state.searchResults;

    const imageList =
      Array.isArray(state.images) && state.images.length > 0
        ? `Available Images:\n${state.images.map((img, i) => `Image ${i + 1}: ${img}`).join("\n")}`
        : "";

    systemPrompt += `\n\nGuidelines for answering search-based questions:
1. If the user is asking about a person (biography, profile, career, bio of a celebrity, public figure, historical figure, etc.):
   - Provide a comprehensive "A to Z" profile of the person covering: Full Name, Date of Birth, Birthplace, Nationality, Early Life, Education, Career Timeline, Major Achievements, and Current Status/Net Worth (if applicable).
   - You MUST select 1 or 2 high-quality images of the person from the "Available Images" list below and render them inline directly inside the biography (preferably at the top) using standard markdown format: \`![Person Name](image_url)\`.
   - Include clickable links to authoritative sources, and explicitly extract and list any official social media or developer links found in the search results (such as Instagram, GitHub, LinkedIn, Twitter/X, YouTube, or official website) using standard markdown \`[Social Name](url)\`.
   - Explicitly list any project portfolios or deployment links hosted on hosting services like Vercel (e.g. *.vercel.app), Netlify (e.g. *.netlify.app), or GitHub Pages (e.g. *.github.io) if they are found in the search results.
2. For all search-related answers, always list the first 2-3 primary reference links (the top web sources) under a "References" header at the very end of your response so the user can easily visit them.
3. If presenting products or items from the search results, try to match the relevant image URLs from available images with the specific products in the list. Render each matched image inline using markdown syntax: \`![Product Title](image_url)\` and display a clear, clickable markdown link to the product page using \`[View Product](product_url)\`. Make sure the image is shown directly under the product title/details.`;

    userContent = `Context / Search Results:\n${formattedResults}\n\n${imageList}\n\nUser Question:\n${state.prompt}`;
  }

  // Previous chat history ko compile karke LangChain message formats me build karte hain.
  const messages = [
    new SystemMessage(systemPrompt),
    ...(state.history || []).map((msg) => {
      if (msg.role === "assistant" || msg.role === "bot") {
        return new AIMessage(msg.content);
      }
      return new HumanMessage(msg.content);
    }),
    new HumanMessage(userContent),
  ];

  // LLM se response streaming reader trigger kiya.
  const responseStream = await llm.stream(messages);

  let content = "";
  for await (const chunk of responseStream) {
    content += chunk.content;
  }

  // output me LLM source information include check so user can see it
  let llmInfo = `[LLM Called: Ollama Minimax for chat tasks.]`;
  if (
    state.searchResults &&
    Array.isArray(state.searchResults) &&
    state.searchResults.length > 0
  ) {
    llmInfo +=
      `\n[Web Search Executed: Found ${state.searchResults.length} results]\n` +
      state.searchResults
        .map((res, idx) => `  - Result ${idx + 1}: ${res.title} (${res.url})`)
        .join("\n");
  }
  console.log(`Chat Agent executed: ${llmInfo}`);

  return {
    aiResponse: content, // Clean content — no think wrapping (Minimax doesn't use think tokens)
  };
};
