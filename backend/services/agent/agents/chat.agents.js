import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
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
    timeZoneName: "short"
  });

  const systemPrompt = `You are CortexAI, an intelligent AI assistant created by Rishabh Jain.
Current system time and date: ${currentDateTimeString}.
Use this current time as reference when answering time-sensitive questions (like 'current time', 'today', 'yesterday', etc.).`;
  
  // Default userContent user ka original prompt hi rahega
  let userContent = state.prompt;
  
  // Agar search results available hain toh use user prompt ke saath inject karte hain taaki assistant context read kar sake.
  if (state.searchResults) {
    const formattedResults = Array.isArray(state.searchResults)
      ? state.searchResults.map((res, i) => `[${i + 1}] Title: ${res.title}\nURL: ${res.url}\nContent: ${res.content}`).join("\n\n")
      : state.searchResults;

    const imageList = Array.isArray(state.images) && state.images.length > 0
      ? `Available Images:\n${state.images.map((img, i) => `Image ${i + 1}: ${img}`).join("\n")}`
      : "";

    userContent = `Context / Search Results:\n${formattedResults}\n\n${imageList}\n\nUser Question:\n${state.prompt}\n\n` +
      `Instructions:\n` +
      `1. If the user is asking about a person (biography, profile, career, bio of a celebrity, public figure, historical figure, etc.):\n` +
      `   - Provide a comprehensive "A to Z" profile of the person covering: Full Name, Date of Birth, Birthplace, Nationality, Early Life, Education, Career Timeline, Major Achievements, and Current Status/Net Worth (if applicable).\n` +
      `   - Match and render inline markdown images of the person from "Available Images" using \`![Person Name](image_url)\`.\n` +
      `   - Include clickable links to authoritative sources, and explicitly extract and list any official social media or developer links found in the search results (such as Instagram, GitHub, LinkedIn, Twitter/X, YouTube, or official website) using standard markdown \`[Social Name](url)\`.\n` +
      `   - Explicitly list any project portfolios or deployment links hosted on hosting services like Vercel (e.g. *.vercel.app), Netlify (e.g. *.netlify.app), or GitHub Pages (e.g. *.github.io) if they are found in the search results.\n` +
      `2. For all search-related answers, always list the first 2-3 primary reference links (the top web sources) under a "References" header at the very end of your response so the user can easily visit them.\n` +
      `3. If presenting products or items from the search results, try to match the relevant image URLs from "Available Images" with the specific products in the list. Render each matched image inline using markdown syntax: \`![Product Title](image_url)\` and display a clear, clickable markdown link to the product page using \`[View Product](product_url)\`. Make sure the image is shown directly under the product title/details.`;
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
  let llmInfo = `[LLM Called: Ollama (Minimax) for chat tasks.]`;
  if (state.searchResults && Array.isArray(state.searchResults) && state.searchResults.length > 0) {
    llmInfo += `\n[Web Search Executed: Found ${state.searchResults.length} results]\n` + 
      state.searchResults.map((res, idx) => `  - Result ${idx + 1}: ${res.title} (${res.url})`).join("\n");
  }
  console.log(`Chat Agent executed: ${llmInfo}`);

  let finalContent = content;
  if (finalContent.includes("<think>")) {
    finalContent = finalContent.replace("<think>", `<think>${llmInfo}\n`);
  } else {
    finalContent = `<think>${llmInfo}</think>\n` + finalContent;
  }

  return {
    aiResponse: finalContent,
  };
};
