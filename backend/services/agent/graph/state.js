import { Annotation } from "@langchain/langgraph";

// LangGraph ka root schema jisme chat flow ke dynamic data inputs save honge
export const AgentState=Annotation.Root({
    prompt:Annotation(), // user ka fresh input query
    searchResults:Annotation(), // search content details
    aiResponse:Annotation(), // llm final generated response
    agent:Annotation(), // path decision variable (chat, coding etc)
    conversationId:Annotation(), // unique chat id reference
    history:Annotation(), // previous conversations logs
    model:Annotation(), // active model selection name
    images:Annotation(), // search results images urls
    file:Annotation()
})