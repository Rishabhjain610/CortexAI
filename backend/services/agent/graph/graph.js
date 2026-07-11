import { StateGraph, END } from "@langchain/langgraph";
import { AgentState } from "./state.js";
import { router } from "./router.js";
import { chatAgent } from "../agents/chat.agents.js";
import { imageAgent } from "../agents/image.agents.js";
import { pdfAgent } from "../agents/pdf.agents.js";
import { searchAgent } from "../agents/search.agents.js";
import { pptAgent } from "../agents/ppt.agents.js";
import { codingAgent } from "../agents/coding.agents.js";

const workflow = new StateGraph(AgentState);

// 1. Add all nodes
workflow.addNode("router", router);
workflow.addNode("chatAgent", chatAgent);
workflow.addNode("imageAgent", imageAgent);
workflow.addNode("pdfAgent", pdfAgent);
workflow.addNode("searchAgent", searchAgent);
workflow.addNode("pptAgent", pptAgent);
workflow.addNode("codingAgent", codingAgent);

// 2. Set entry point
workflow.addEdge("__start__", "router");

// 3. Define conditional edges based on state.agent value determined by router
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

// 4. Add transition from agents to the END node
workflow.addEdge("chatAgent", END);
workflow.addEdge("imageAgent", END);
workflow.addEdge("pdfAgent", END);
workflow.addEdge("searchAgent", END);
workflow.addEdge("pptAgent", END);
workflow.addEdge("codingAgent", END);

// 5. Compile the workflow graph
const app = workflow.compile();

export default app;
