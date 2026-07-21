// Router node function: User request ko 3-layer system se sahi agent pe route karta hai —
// Layer 1: Manual agent selection (user ne UI se select kiya)
// Layer 2: Deterministic keyword heuristics (fast, no LLM call)
// Layer 3: LLM fallback (Ollama Minimax, local, no API rate limits)
export const router = async (state) => {
  console.log("--- ROUTER NODE ---");
  const { prompt, agent, file } = state;

  // --- LAYER 1: Manual Selection ---
  // Agar user ne UI panel me pehle se koi agent manually select kar rakha hai toh seedha use route karo.
  // Exception: Agar agent "pdfAgent" ya "pdfRagAgent" select hai AUR file bhi attached hai,
  // toh hamesha pdfRagAgent pe bhejo — RAG pipeline better answer deta hai uploaded document ke liye.
  if (agent && agent !== "auto") {
    if ((agent === "pdfAgent" || agent === "pdfRagAgent") && file) {
      console.log(`Routed manual PDF request with attached file to: pdfRagAgent`);
      return { agent: "pdfRagAgent" };
    }
    console.log(`Routed directly to manually selected agent: ${agent}`);
    return { agent };
  }

  // --- LAYER 1.5: File-based Routing ---
  // Agar request me file attached hai toh uska MIME type aur extension check karke directly agent decide karo.
  // Yeh LLM call aur keyword matching se pehle hota hai — fast aur deterministic.
  if (file) {
    const ext = (file.originalname || "").toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();

    // PDF file detect hone par RAG pipeline trigger karo
    if (ext.endsWith(".pdf") || mime === "application/pdf") {
      console.log(`Routed by File Type (.pdf) to: pdfRagAgent`);
      return { agent: "pdfRagAgent" };
    }

    // Image file detect hone par vision analyzer trigger karo
    // Multiple extensions support kiye hain — jpg, jpeg, png, webp, gif, bmp, svg
    if (
      mime.startsWith("image/") ||
      ext.endsWith(".jpg") ||
      ext.endsWith(".jpeg") ||
      ext.endsWith(".png") ||
      ext.endsWith(".webp") ||
      ext.endsWith(".gif") ||
      ext.endsWith(".bmp") ||
      ext.endsWith(".svg")
    ) {
      console.log(`Routed by File Type (image) to: imageAnalyzer`);
      return { agent: "imageAnalyzer" };
    }
  }

  const cleanPrompt = (prompt || "").trim().toLowerCase();

  // Word-boundary matching helper — substring collision se bachne ke liye.
  const matchKeyword = (keyword) => {
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}s?\\b`, 'i');
    return regex.test(cleanPrompt);
  };

  // Basic math expressions check (e.g. "1+1", "25 * 4", "tell me 1+1")
  const isMathQuery = /^[\d\s\+\-\*\/\(\)\.]{3,}$/.test(cleanPrompt) || /^\d+\s*[\+\-\*\/]\s*\d+$/.test(cleanPrompt) || /^\s*(tell|what|calculate|compute)?\s*(me)?\s*\d+\s*[\+\-\*\/]\s*\d+\s*$/i.test(cleanPrompt);
  if (isMathQuery) {
    console.log(`Routed by Math Heuristic to: chatAgent`);
    return { agent: "chatAgent" };
  }

  // --- LAYER 2: Deterministic Keyword Heuristics ---
  const docKeywords = ["pdf", "pdfs", "document", "documents", "file", "files", "resume", "cv", "uploaded", "paper", "cgpa", "marks", "grade", "gpa"];
  const hasDocKeyword = docKeywords.some(matchKeyword);

  // Web Search keywords
  const searchKeywords = [
    "search", "google", "tavily", "weather", "news", "current time", "time in", 
    "price", "rate", "cost", "how much", "buy", "shop", "stock", "shares", 
    "live", "today", "yesterday", "forecast", "who is", "who was", "biography",
    "bio of", "born in", "born on", "spouse", "career of", "gather info", 
    "gather information", "research", "lookup", "look up", "info", "information", "details", 
    "find out", "find details", "current", "latest", "recent", "about"
  ];

  // Code/Programming keywords
  const codingKeywords = [
    "code", "coding", "program", "programming", "python", "javascript", "react", "html", "css", "java", 
    "c++", "c#", "ruby", "rust", "function", "compile", "debug", "error", "api", 
    "database", "sql", "website", "webpage", "web page", "app", "apps", "application", "applications",
    "ui", "interface", "template", "page"
  ];

  // Image generation keywords
  const imageKeywords = [
    "draw", "paint", "sketch", "illustration",
    "generate image", "generate a image", "generate an image",
    "create image", "create a image", "create an image",
    "make image", "make a image", "make an image",
    "create photo", "create a photo", "generate photo", "generate a photo",
    "picture of", "image of", "photo of",
    "render image", "design image"
  ];

  // If prompt explicitly targets non-PDF actions (Code, Search, Image) AND does not mention document keywords:
  if (!hasDocKeyword) {
    if (imageKeywords.some(matchKeyword)) {
      console.log(`Routed by Keyword Heuristic to: imageAgent`);
      return { agent: "imageAgent" };
    }
    if (codingKeywords.some(matchKeyword)) {
      console.log(`Routed by Keyword Heuristic to: codingAgent`);
      return { agent: "codingAgent" };
    }
    if (searchKeywords.some(matchKeyword)) {
      console.log(`Routed by Keyword Heuristic to: searchAgent`);
      return { agent: "searchAgent" };
    }
  }

  // --- LAYER 2.5: Active PDF Session Check ---
  // Agar prompt me direct document keyword ho aur session active ho, toh seedha pdfRagAgent pe bhejo.
  // Baaki cases Layer 3 LLM Classifier handle karega taaki RAG vs Chat Agent intelligent switching ho sake.
  if (state.conversationId && hasDocKeyword) {
    try {
      const { default: redis } = await import("../../../shared/redis/redis.js");
      const activeCollection = await redis.get(`pdf:collection:${state.conversationId}`);
      if (activeCollection) {
        console.log(`Routed to pdfRagAgent due to active PDF collection (doc keyword): ${activeCollection}`);
        return { agent: "pdfRagAgent" };
      }
    } catch (redisErr) {
      console.error("Failed to check active PDF session in router:", redisErr.message);
    }
  }

  // PDF keywords
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

  // PPT/Presentation keywords
  const pptKeywords = ["ppt", "pptx", "presentation", "presentations", "presntation", "presenation", "presentaton", "slide", "slides", "powerpoint", "deck", "slideshow"];
  if (pptKeywords.some(matchKeyword)) {
    if (topicIndicators.some(matchKeyword)) {
      console.log(`Routed by Keyword Heuristic (topic-ppt) to: searchAgent`);
      return { agent: "searchAgent" };
    }
    console.log(`Routed by Keyword Heuristic to: pptAgent`);
    return { agent: "pptAgent" };
  }

  // --- LAYER 3: LLM Fallback (Ollama Minimax, local) ---
  // Jab koi keyword match nahi karta, Ollama local model se classify karo.
  try {
    let hasActivePdf = false;
    if (state.conversationId) {
      try {
        const { default: redis } = await import("../../../shared/redis/redis.js");
        hasActivePdf = !!(await redis.get(`pdf:collection:${state.conversationId}`));
      } catch {}
    }

    const { getModel } = await import("../config/model.js");
    const llm = getModel("chatAgent");

    const systemPrompt = hasActivePdf
      ? `You are a routing agent for CortexAI. An active PDF document is attached to this chat session. Classify the user's prompt into one of these agents:
- pdfRagAgent: The user is asking a question about the uploaded PDF document, resume, CV, person's profile, education, projects, skills, CGPA, experience, or facts inside the document.
- chatAgent: General conversation, greetings, jokes, math, general knowledge, explanations NOT related to the document.
- searchAgent: Questions needing live web info, current events, who/what/where queries, facts about people/places.
- codingAgent: Writing, debugging, or explaining code, programming, and building apps.
- imageAgent: Generating, drawing, or creating images/photos/art.
- pptAgent: Creating presentations or slide decks.

Reply with ONLY the agent name (e.g. pdfRagAgent or chatAgent). No explanation.`
      : `You are a routing agent for CortexAI. Classify the user's prompt into one of these agents:
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

    // LLM response se extra quotes, backticks, newlines strip kiye — clean agent name extract kiya
    const classification = (response.content || "").trim().replace(/['"\`\n]/g, "");
    const validAgents = ["chatAgent", "codingAgent", "imageAgent", "pdfAgent", "pptAgent", "searchAgent", "pdfRagAgent"];

    // Agar LLM ne koi invalid ya unknown agent name diya toh safe fallback
    const targetAgent = validAgents.includes(classification) ? classification : (hasActivePdf ? "pdfRagAgent" : "chatAgent");

    console.log(`Routed by Minimax LLM to: ${targetAgent}`);
    return { agent: targetAgent };
  } catch (err) {
    // Agar Ollama server down ho ya LLM call fail ho toh bhi crash mat karo — chatAgent pe default karo
    console.error("LLM router fallback failed, defaulting to chatAgent:", err.message);
    return { agent: "chatAgent" };
  }
};
