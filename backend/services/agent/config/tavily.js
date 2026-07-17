import { TavilySearch } from "@langchain/tavily";

// Tavily Search API client setup: Web searches aur image outputs fetch karne ke liye tool instance.
const Search_tool = new TavilySearch({
  tavilyApiKey: process.env.TAVILY_API_KEY,
  maxResults: 5,
  includeImages: true,
  autoParameters: true,
});
export default Search_tool;
