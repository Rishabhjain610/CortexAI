// Router node function: Keyword heuristics se sahi agent ko route karta hai. No LLM calls.
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

  // Word-boundary matching helper to prevent substring collisions (e.g. "rate" inside "generate")
  const matchKeyword = (keyword) => {
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}s?\\b`, 'i');
    return regex.test(cleanPrompt);
  };

  // 2. Deterministic Keyword Heuristics
  // Web Search keywords heuristics.
  const searchKeywords = [
    "search", "google", "tavily", "weather", "news", "current time", "time in", 
    "price", "rate", "cost", "how much", "buy", "shop", "stock", "shares", 
    "live", "today", "yesterday", "forecast", "who is", "who was", "biography",
    "bio of", "born in", "born on", "spouse", "career of", "gather info", 
    "gather information", "research", "lookup", "look up", "info", "information", "details", 
    "find out", "find details", "current", "latest", "recent", "about"
  ];
  if (searchKeywords.some(matchKeyword)) {
    console.log(`Routed by Keyword Heuristic to: searchAgent`);
    return { agent: "searchAgent" };
  }

  // Code coding keywords heuristics.
  const codingKeywords = [
    "code", "coding", "program", "programming", "python", "javascript", "react", "html", "css", "java", 
    "c++", "c#", "ruby", "rust", "function", "compile", "debug", "error", "api", 
    "database", "sql", "website", "webpage", "web page", "app", "apps", "application", "applications",
    "ui", "interface", "template", "page"
  ];
  if (codingKeywords.some(matchKeyword)) {
    console.log(`Routed by Keyword Heuristic to: codingAgent`);
    return { agent: "codingAgent" };
  }

  // Document/PDF keywords heuristics.
  const topicIndicators = ["on", "about", "compare", "how to", "history", "explain", "topic", "information", "details"];
  
  const pdfKeywords = ["pdf", "pdfs", "document", "documents", "file", "files", "invoice", "resume", "cv", "paper"];
  if (pdfKeywords.some(matchKeyword)) {
    if (topicIndicators.some(matchKeyword)) {
      console.log(`Routed by Keyword Heuristic (topic-pdf) to: searchAgent`);
      return { agent: "searchAgent" };
    }
    console.log(`Routed by Keyword Heuristic to: pdfAgent`);
    return { agent: "pdfAgent" };
  }

  // Slide Deck keywords heuristics.
  const pptKeywords = ["ppt", "pptx", "presentation", "presentations", "presntation", "presenation", "presentaton", "slide", "slides", "powerpoint", "deck", "slideshow"];
  if (pptKeywords.some(matchKeyword)) {
    if (topicIndicators.some(matchKeyword)) {
      console.log(`Routed by Keyword Heuristic (topic-ppt) to: searchAgent`);
      return { agent: "searchAgent" };
    }
    console.log(`Routed by Keyword Heuristic to: pptAgent`);
    return { agent: "pptAgent" };
  }

  // Graphic / Image creation keywords heuristics.
  const imageKeywords = [
    "draw", "paint", "sketch", "illustration",
    "generate image", "generate a image", "generate an image",
    "create image", "create a image", "create an image",
    "make image", "make a image", "make an image",
    "create photo", "create a photo", "generate photo", "generate a photo",
    "picture of", "image of", "photo of",
    "render image", "design image"
  ];
  if (imageKeywords.some(matchKeyword)) {
    console.log(`Routed by Keyword Heuristic to: imageAgent`);
    return { agent: "imageAgent" };
  }

  // 3. LLM Fallback — Minimax (Ollama, local) se classify karo. No rate limits.
  try {
    const { getModel } = await import("../config/model.js");
    const llm = getModel("chatAgent"); // Minimax Ollama — local, no API rate limits
    const systemPrompt = `You are a routing agent for CortexAI. Classify the user's prompt into one of these agents:
- chatAgent: General conversation, greetings, jokes, opinions, chit-chat
- searchAgent: Questions needing live web info, current events, who/what/where queries, facts about people/places
- codingAgent: Writing, debugging, or explaining code and programming
- imageAgent: Generating, drawing, or creating images/photos/art
- pdfAgent: Creating or working with PDF documents, resumes, reports
- pptAgent: Creating presentations or slide decks

Reply with ONLY the agent name (e.g. chatAgent). No explanation.`;

    const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt || ""),
    ]);

    const classification = (response.content || "").trim().replace(/['\"`\n]/g, "");
    const validAgents = ["chatAgent", "codingAgent", "imageAgent", "pdfAgent", "pptAgent", "searchAgent"];
    const targetAgent = validAgents.includes(classification) ? classification : "chatAgent";

    console.log(`Routed by Minimax LLM to: ${targetAgent}`);
    return { agent: targetAgent };
  } catch (err) {
    console.error("LLM router fallback failed, defaulting to chatAgent:", err.message);
    return { agent: "chatAgent" };
  }
};
