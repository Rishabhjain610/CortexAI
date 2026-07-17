import { StateGraph, END } from "@langchain/langgraph";
import { AgentState } from "./state.js";
import { router } from "./router.js";
import { chatAgent } from "../agents/chat.agents.js";
import { imageAgent } from "../agents/image.agents.js";
import { pdfAgent } from "../agents/pdf.agents.js";
import { searchAgent } from "../agents/search.agents.js";
import { pptAgent } from "../agents/ppt.agents.js";
import { codingAgent } from "../agents/coding.agents.js";

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
  }
);

// 4. Agar prompt searchAgent par gaya tha, toh search hone ke baad decision logic:
// Agar user ka prompt coding-related hai toh use codingAgent par bhejenge (taaki retrieved images/results coding context me inject ho sakein),
// Varna normal summarized conversation ke liye chatAgent default fallback hai.
workflow.addConditionalEdges(
  "searchAgent",
  (state) => {
    const cleanPrompt = (state.prompt || "").trim().toLowerCase();
    const codingKeywords = [
      "code", "program", "python", "javascript", "react", "html", "css", "java", 
      "c++", "c#", "ruby", "rust", "function", "compile", "debug", "error", "api", 
      "database", "sql", "website", "webpage", "web page", "app", "application",
      "ui", "interface", "template", "page"
    ];
    if (codingKeywords.some(keyword => cleanPrompt.includes(keyword))) {
      console.log("Search complete. Routing to codingAgent for code generation.");
      return "codingAgent";
    }
    console.log("Search complete. Routing to chatAgent for conversation.");
    return "chatAgent";
  },
  {
    codingAgent: "codingAgent",
    chatAgent: "chatAgent",
  }
);

// Baaki saare agents tasks complete hone par seedhe output finish (END) karte hain
workflow.addEdge("chatAgent", "__end__");
workflow.addEdge("imageAgent", "__end__");
workflow.addEdge("pdfAgent", "__end__");
workflow.addEdge("pptAgent", "__end__");
workflow.addEdge("codingAgent", "__end__");

// 5. Poore graph configuration flow ko compile karke default export set kiya
const app = workflow.compile();

export default app;
