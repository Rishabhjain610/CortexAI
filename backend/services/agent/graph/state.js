import { Annotation } from "@langchain/langgraph";

export const AgentState=Annotation.Root({
    prompt:Annotation(),
    searchResults:Annotation(), // Naya field search results/context ko carrying karne ke liye
    aiResponse:Annotation(),
    agent:Annotation(),
    conversationId:Annotation(),
    history:Annotation(),
    model:Annotation(),
    images:Annotation()
})