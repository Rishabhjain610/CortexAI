import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";

export const chatAgent = async (state) => {
  console.log("--- CHAT AGENT ---");
  
  // getModel is synchronous, no await needed
  const llm = getModel("chatAgent"); 
  
  const systemPrompt = "You are CortexAI, an intelligent AI assistant created by Rishabh Jain.";
  
  // Default userContent user ka original prompt hi rahega
  let userContent = state.prompt;
  
  // Agar pichle search node ne search results dhundh kar state me daale hain (state.searchResults),
  // toh use hum user ke prompt ke sath context ki tarah mila denge taaki LLM ko accurate context mile.
  if (state.searchResults) {
    userContent = `Context / Search Results:\n${state.searchResults}\n\nUser Question:\n${state.prompt}`;
  }

  // LangChain ke classes (SystemMessage, HumanMessage, AIMessage) ka use karke array create kiya
  const messages = [
    new SystemMessage(systemPrompt),
    ...(state.history || []).map((msg) => {
      if (msg.role === "assistant" || msg.role === "bot") {
        return new AIMessage(msg.content);
      }
      return new HumanMessage(msg.content);
    }),
    new HumanMessage(userContent),
  ];

  // LLM se real-time response stream karne ke liye stream method call kiya.
  const responseStream = await llm.stream(messages);

  let content = "";
  // Har ek generated token/chunk ko iterate karke consume karenge aur client ko real-time data milega.
  for await (const chunk of responseStream) {
    content += chunk.content;
  }

  // Pure accumulated text ko final state.aiResponse ke andar return kar rahe hain.
  return {
    aiResponse: content,
  };
};
