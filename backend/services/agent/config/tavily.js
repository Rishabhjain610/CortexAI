import { TavilySearch } from "@langchain/tavily";

// Tavily Search API client — real-time web search aur image fetching ke liye.
// maxResults: 5 — Top 5 search results lo, zyada results LLM context window overflow kar sakte hain.
// includeImages: true — Search results ke saath relevant images bhi fetch karo (profile pics, product images etc.)
// autoParameters: true — Tavily automatically query parameters optimize karta hai (date filters, domain filters etc.)
const Search_tool = new TavilySearch({
  tavilyApiKey: process.env.TAVILY_API_KEY,
  maxResults: 5,
  includeImages: true,
  autoParameters: true,
});

export default Search_tool;
