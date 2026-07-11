export const router = async (state) => {
  console.log("--- ROUTER NODE ---");
  const { prompt } = state;
  let targetAgent = "chatAgent"; // Default agent

  const lowerPrompt = (prompt || "").toLowerCase();
  switch (true) {
    case lowerPrompt.includes("image") || lowerPrompt.includes("picture") || lowerPrompt.includes("generate"):
      targetAgent = "imageAgent";
      break;
    case lowerPrompt.includes("pdf") || lowerPrompt.includes("document"):
      targetAgent = "pdfAgent";
      break;
    case lowerPrompt.includes("search") || lowerPrompt.includes("web") || lowerPrompt.includes("google"):
      targetAgent = "searchAgent";
      break;
    case lowerPrompt.includes("ppt") || lowerPrompt.includes("slide") || lowerPrompt.includes("presentation"):
      targetAgent = "pptAgent";
      break;
    case lowerPrompt.includes("code") || lowerPrompt.includes("coding") || lowerPrompt.includes("program"):
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