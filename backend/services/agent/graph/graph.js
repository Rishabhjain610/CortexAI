import { StateGraph, END } from "@langchain/langgraph";
import { AgentState } from "./state.js";
import { router } from "./router.js";
import { chatAgent } from "../agents/chat.agents.js";
import { imageAgent } from "../agents/image.agents.js";
import { pdfAgent } from "../agents/pdf.agents.js";
import { searchAgent } from "../agents/search.agents.js";
import { pptAgent } from "../agents/ppt.agents.js";
import { codingAgent } from "../agents/coding.agents.js";
import { pdfRagAgent } from "../agents/pdfRag.agent.js";
import { imageAnalyzer } from "../agents/imageAnalyzer.agent.js";
// LangGraph ka StateGraph instance initiate kar rahe hain jisme saare states manage honge
const workflow = new StateGraph(AgentState);

// 1. Graph workflow me nodes add karna - har node ek alag assistant function/agent hai
workflow.addNode("router", router);
workflow.addNode("chatAgent", chatAgent);
workflow.addNode("imageAgent", imageAgent);
workflow.addNode("pdfAgent", pdfAgent);
workflow.addNode("searchAgent", searchAgent);
workflow.addNode("pptAgent", pptAgent);
workflow.addNode("codingAgent", codingAgent);
workflow.addNode("pdfRagAgent", pdfRagAgent);
workflow.addNode("imageAnalyzer", imageAnalyzer);

// 2. Entry point set kiya - request sabse pehle router node par jayegi
workflow.addEdge("__start__", "router");

// 3. Router node prompt check karke path (agent name) decide karega aur state return karega
workflow.addConditionalEdges(
  "router",
  (state) => state.agent,
  {
    chatAgent: "chatAgent",
    imageAgent: "imageAgent",
    pdfAgent: "pdfAgent",
    searchAgent: "searchAgent",
    pptAgent: "pptAgent",
    codingAgent: "codingAgent",
    pdfRagAgent:"pdfRagAgent",
    imageAnalyzer:"imageAnalyzer"
  }
);

// 4. Agar prompt searchAgent par gaya tha, toh search hone ke baad decision logic:
// Agar user ka prompt coding-related hai toh use codingAgent par bhejenge (taaki retrieved images/results coding context me inject ho sakein),
// Varna normal summarized conversation ke liye chatAgent default fallback hai.
workflow.addConditionalEdges(
  "searchAgent",
  async (state) => {
    const cleanPrompt = (state.prompt || "").trim().toLowerCase();
    const matchKeyword = (keyword) => {
      const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}s?\\b`, 'i');
      return regex.test(cleanPrompt);
    };

    const codingKeywords = [
      "code", "coding", "program", "programming", "python", "javascript", "react", "html", "css", "java", 
      "c++", "c#", "ruby", "rust", "function", "compile", "debug", "error", "api", 
      "database", "sql", "website", "webpage", "web page", "app", "apps", "application", "applications",
      "ui", "interface", "template", "page"
    ];
    if (codingKeywords.some(matchKeyword)) {
      console.log("Search complete. Routing to codingAgent for code generation.");
      return "codingAgent";
    }
    
    const pdfKeyword = ["pdf", "pdfs", "document", "documents", "file", "files", "invoice", "resume", "cv", "paper"];
    if (pdfKeyword.some(matchKeyword)) {
      console.log("Search complete. Routing to pdfAgent for pdf summary.");
      return "pdfAgent";
    }
    
    const pptKeyword = ["presentation", "presentations", "presntation", "presenation", "presentaton", "slide", "slides", "powerpoint", "deck", "slideshow", "ppt", "pptx"];
    if (pptKeyword.some(matchKeyword)) {
      console.log("Search complete. Routing to pptAgent for presentation summary.");
      return "pptAgent";
    }
    
    // LLM Fallback routing using Ollama Minimax model
    try {
      const { getModel } = await import("../config/model.js");
      const { SystemMessage, HumanMessage } = await import("@langchain/core/messages");
      
      const llm = getModel("chatAgent"); // local minimax model
      const systemPrompt = `You are a routing agent for CortexAI.
After a web search is completed, classify the user's original request into the correct final agent:
- codingAgent: If the user wants a website, webpage, code, app, or template generated.
- pdfAgent: If the user wants a document, report, resume, CV, or PDF file generated.
- pptAgent: If the user wants a presentation, slide deck, PowerPoint, or slideshow generated.
- chatAgent: For general questions, summaries, discussions, or normal chat.

Reply with ONLY the agent name (one of: codingAgent, pdfAgent, pptAgent, chatAgent). No explanation, no quotes.`;

      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(state.prompt || ""),
      ]);

      const classification = (response.content || "").trim().replace(/['\"`\n]/g, "");
      const validAgents = ["codingAgent", "pdfAgent", "pptAgent", "chatAgent"];
      
      if (validAgents.includes(classification)) {
        console.log(`Search complete. Routed by Minimax LLM to: ${classification}`);
        return classification;
      }
    } catch (err) {
      console.error("SearchAgent conditional edge LLM fallback failed, defaulting to chatAgent:", err.message);
    }
    
    console.log("Search complete. Routing to chatAgent for conversation.");
    return "chatAgent";
  },
  {
    codingAgent: "codingAgent",
    pptAgent: "pptAgent",
    pdfAgent: "pdfAgent",
    chatAgent: "chatAgent",
  }
);

// Baaki saare agents tasks complete hone par seedhe output finish (END) karte hain
workflow.addEdge("chatAgent", "__end__");
workflow.addEdge("imageAgent", "__end__");
workflow.addEdge("pdfAgent", "__end__");
workflow.addEdge("pptAgent", "__end__");
workflow.addEdge("codingAgent", "__end__");
workflow.addEdge("pdfRagAgent", "__end__");
workflow.addEdge("imageAnalyzer", "__end__");
// 5. Poore graph configuration flow ko compile karke default export set kiya
const app = workflow.compile();

export default app;
