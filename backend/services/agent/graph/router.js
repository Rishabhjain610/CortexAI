export const router = async (state) => {
  console.log("--- ROUTER NODE ---");
  const { prompt, webSearch, agent } = state;
  let targetAgent = "chatAgent"; // Default agent

  // If a specific agent is manually selected by the user, route directly to it!
  if (agent && agent !== "auto") {
    console.log(`Routed directly to manually selected agent: ${agent}`);
    return { agent };
  }

  // If Web Search toggle is turned on, force searchAgent routing
  if (webSearch) {
    console.log("Routed to: searchAgent (Web Search toggle is ON)");
    return {
      agent: "searchAgent",
    };
  }

  const lowerPrompt = (prompt || "").toLowerCase();
  switch (true) {
    case lowerPrompt.includes("image") ||
      lowerPrompt.includes("picture") ||
      lowerPrompt.includes("generate"):
      targetAgent = "imageAgent";
      break;
    case lowerPrompt.includes("pdf") || lowerPrompt.includes("document"):
      targetAgent = "pdfAgent";
      break;
    case lowerPrompt.includes("search") ||
      lowerPrompt.includes("web") ||
      lowerPrompt.includes("google"):
      targetAgent = "searchAgent";
      break;
    case lowerPrompt.includes("ppt") ||
      lowerPrompt.includes("slide") ||
      lowerPrompt.includes("presentation"):
      targetAgent = "pptAgent";
      break;
    case lowerPrompt.includes("code") ||
      lowerPrompt.includes("coding") ||
      lowerPrompt.includes("program"):
      targetAgent = "codingAgent";
      break;
    default:
      targetAgent = "chatAgent";
  }

  console.log(`Routed to: ${targetAgent}`);
  return {
    agent: targetAgent,
  };
};
