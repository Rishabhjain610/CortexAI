import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";

// Image Agent Node: Graphic generation aur image tasks ko represent karne wala dummy agent.
export const imageAgent = async (state) => {
  console.log("--- IMAGE AGENT ---");
  const llm = getModel("imageAgent");
  
  const messages = [
    new SystemMessage("You are Image Agent. Reply with ONLY: 'Hi from Image Agent'"),
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