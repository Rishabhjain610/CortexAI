import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";

// PDF Agent Node: Documents aur PDF query processing ko support karne wala dummy agent handler.
export const pdfAgent = async (state) => {
  console.log("--- PDF AGENT ---");
  const llm = getModel("pdfAgent");
  
  const messages = [
    new SystemMessage("You are PDF Agent. Reply with ONLY: 'Hi from PDF Agent'"),
    new HumanMessage(state.prompt),
  ];

  const responseStream = await llm.stream(messages);

  let content = "";
  for await (const chunk of responseStream) {
    content += chunk.content;
  }

  return {
    aiResponse: content,
  };
};
