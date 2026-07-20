import { Annotation } from "@langchain/langgraph";

// LangGraph ka root schema — puri agent graph pipeline ke andar flow hone wala shared state object.
// Har Annotation() ek mutable field define karta hai jo graph ke nodes (router, chatAgent, etc.) read/write kar sakte hain.
// Yeh object ek turn ke andar naya state banata hai — next turn pe fresh state milta hai (persistence agent ke bahar nahi hoti).
export const AgentState = Annotation.Root({
  prompt: Annotation(),         // User ka fresh input query — is turn me kya poochha
  searchResults: Annotation(),  // searchAgent ke baad Tavily se aaye results inject kiye jaate hain
  aiResponse: Annotation(),     // Final LLM generated response (non-streaming agents ke liye)
  agent: Annotation(),          // Router ka decision variable — "chatAgent", "codingAgent", "pdfRagAgent" etc.
  conversationId: Annotation(), // MongoDB conversation document ka unique _id reference
  history: Annotation(),        // Pichle turns ke messages — multi-turn memory ke liye
  model: Annotation(),          // Frontend se selected model name (future model switching ke liye)
  images: Annotation(),         // Tavily ya imageAgent ke image URLs
  file: Annotation()            // Multer se aaya uploaded file object (path, mimetype, originalname)
})