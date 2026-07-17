import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";

// PPT Agent Node: Slide creations aur Presentation tasks ko handle karne wala dummy handler.
export const pptAgent = async (state) => {
  console.log("--- PPT AGENT ---");
  const llm = getModel("pptAgent");
  
  const messages = [
    new SystemMessage("You are PPT Agent. Reply with ONLY: 'Hi from PPT Agent'"),
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
