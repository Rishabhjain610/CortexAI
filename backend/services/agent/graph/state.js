import { Annotation } from "@langchain/langgraph";

export const AgentState=Annotation.Root({
    prompt:Annotation(),
    aiResponse:Annotation(),
    agent:Annotation()
})