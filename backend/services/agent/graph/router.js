import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";

// Router node function: User request ko dynamic classification (Keyword heuristics and LLM model) ke zariye sahi agent ko redirect karta hai.
export const router = async (state) => {
  console.log("--- ROUTER NODE ---");
  const { prompt, agent } = state;

  // 1. Agar user ne manual panel me pehle se agent select kar rakha hai, toh seedhe use route kar do.
  if (agent && agent !== "auto") {
    console.log(`Routed directly to manually selected agent: ${agent}`);
    return { agent };
  }

  const cleanPrompt = (prompt || "").trim().toLowerCase();

  // 2. Deterministic Keyword Heuristics
  // Web Search keywords heuristics.
  const searchKeywords = [
    "search", "google", "tavily", "weather", "news", "current time", "time in", 
    "price", "rate", "cost", "how much", "buy", "shop", "stock", "shares", 
    "live", "today", "yesterday", "forecast", "who is", "who was", "biography",
    "bio of", "born in", "born on", "spouse", "career of", "gather info", 
    "gather information", "research", "lookup", "look up", "info", "details", 
    "find out", "find details"
  ];
  if (searchKeywords.some(keyword => cleanPrompt.includes(keyword))) {
    console.log(`Routed by Keyword Heuristic to: searchAgent`);
    return { agent: "searchAgent" };
  }

  // Code coding keywords heuristics.
  const codingKeywords = [
    "code", "program", "python", "javascript", "react", "html", "css", "java", 
    "c++", "c#", "ruby", "rust", "function", "compile", "debug", "error", "api", 
    "database", "sql", "website", "webpage", "web page", "app", "application",
    "ui", "interface", "template", "page"
  ];
  if (codingKeywords.some(keyword => cleanPrompt.includes(keyword))) {
    console.log(`Routed by Keyword Heuristic to: codingAgent`);
    return { agent: "codingAgent" };
  }

  // Document/PDF keywords heuristics.
  const pdfKeywords = ["pdf", "document", "file", "invoice", "resume", "cv", "paper"];
  if (pdfKeywords.some(keyword => cleanPrompt.includes(keyword))) {
    console.log(`Routed by Keyword Heuristic to: pdfAgent`);
    return { agent: "pdfAgent" };
  }

  // Slide Deck keywords heuristics.
  const pptKeywords = ["ppt", "presentation", "slide", "powerpoint", "deck", "slideshow"];
  if (pptKeywords.some(keyword => cleanPrompt.includes(keyword))) {
    console.log(`Routed by Keyword Heuristic to: pptAgent`);
    return { agent: "pptAgent" };
  }

  // Graphic / Image creation keywords heuristics.
  const imageKeywords = ["draw", "paint", "generate image", "create photo", "picture of", "illustration", "sketch"];
  if (imageKeywords.some(keyword => cleanPrompt.includes(keyword))) {
    console.log(`Routed by Keyword Heuristic to: imageAgent`);
    return { agent: "imageAgent" };
  }

  // 3. Fallback: Agar kisi keyword se match na ho, toh dynamic LLM prediction use karte hain.
  try {
    const llm = getModel("chatAgent");
    const systemPrompt = `You are the routing manager of CortexAI.
Analyze the user's prompt and classify which specialized agent should handle it.

The available agents are:
- "codingAgent": For writing, explaining, or debugging code, software, and programming tasks.
- "imageAgent": For generating, drawing, or editing images.
- "pdfAgent": For reading, analyzing, or summarizing PDF/document files.
- "pptAgent": For creating or designing presentation slide decks.
- "searchAgent": For queries needing live web search, search engines, current events, or Google search.
- "chatAgent": For general conversation, greetings (like "hi", "hello"), chit-chat, or when no other agent fits.

Here are examples of how to route:
- Prompt: "how do I write a loop in javascript?" -> codingAgent
- Prompt: "create a picture of a cat in space" -> imageAgent
- Prompt: "summarize this uploaded pdf document" -> pdfAgent
- Prompt: "make a presentation about artificial intelligence slides" -> pptAgent
- Prompt: "what is the current stock price of Tesla?" -> searchAgent
- Prompt: "who is the CEO of Google?" -> searchAgent
- Prompt: "tell me about Sundar Pichai biography" -> searchAgent
- Prompt: "tell me about the latest news in India" -> searchAgent
- Prompt: "hi there, what is your name?" -> chatAgent
- Prompt: "tell me a joke" -> chatAgent

Respond with ONLY the name of the agent in lowercase (one of: codingAgent, imageAgent, pdfAgent, pptAgent, searchAgent, chatAgent). Do not include any explanation or punctuation.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt || ""),
    ];

    const response = await llm.invoke(messages);
    const classification = response.content.trim().replace(/['"`]/g, ""); // Double quotes/quotes filter out kiya
    
    const validAgents = ["chatAgent", "codingAgent", "imageAgent", "pdfAgent", "pptAgent", "searchAgent"];
    let targetAgent = "chatAgent";
    
    if (validAgents.includes(classification)) {
      targetAgent = classification;
    }

    console.log(`Routed by Smarter Router to: ${targetAgent} (classified from: "${classification}")`);
    return { agent: targetAgent };
  } catch (error) {
    console.error("Error in smarter router classification, defaulting to chatAgent:", error);
    return { agent: "chatAgent" };
  }
};
