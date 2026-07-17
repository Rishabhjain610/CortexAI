import Search_tool from "../config/tavily.js";

// Search Agent Node: Tavily API search tool use karke web se query parameters, references, aur images query fetch karta hai.
export const searchAgent = async (state) => {
  console.log("--- SEARCH AGENT ---");
  try {
    const results = await Search_tool.invoke({ query: state.prompt });

    if (results.error) {
      console.error("Tavily Search API Error:", results.error);
      return {
        searchResults: "Error in fetching the search results: " + results.error,
        images: [],
      };
    }

    console.log("Search Results:", results);
    return {
      searchResults: results.results || [],
      images: results.images || [],
    };
  } catch (error) {
    console.error("Search agent execution failed:", error);
    return {
      searchResults: "Error in fetching the search results",
      images: [],
    };
  }
};
