import Search_tool from "../config/tavily.js";

// Search Agent Node: Tavily API search tool use karke web se query parameters, references, aur images query fetch karta hai.
// Clean query function: Prompt me se coding instructions aur conversational keywords ko strip karke core search subject nikalta hai.
function cleanSearchQuery(prompt) {
  if (!prompt) return "";
  let query = prompt.trim();
  
  // Strip common prefixes
  const prefixes = [
    /^(generate|make|create|build|design|search\s+for|search|google|find|lookup|look\s+up|gather\s+info\s+about|gather\s+info\s+for|gather\s+information\s+about|gather\s+information\s+for|who\s+is|biography\s+of|bio\s+of)\s+a\s+(portfolio\s+)?(website|webpage|page|app|profile|portfolio|resume|cv)\s+(for|about)\s+/i,
    /^(generate|make|create|build|design|search\s+for|search|google|find|lookup|look\s+up|gather\s+info\s+about|gather\s+info\s+for|gather\s+information\s+about|gather\s+information\s+for|who\s+is|biography\s+of|bio\s+of)\s+(portfolio\s+)?(website|webpage|page|app|profile|portfolio|resume|cv|celebrity|adult\s+star)\s+(for|about|of)\s+/i,
    /^(generate|make|create|build|design|search\s+for|search|google|find|lookup|look\s+up|gather\s+info\s+about|gather\s+info\s+for|gather\s+information\s+about|gather\s+information\s+for|who\s+is|biography\s+of|bio\s+of)\s+/i
  ];

  for (const regex of prefixes) {
    if (regex.test(query)) {
      query = query.replace(regex, "");
      break;
    }
  }

  // Strip common suffixes
  const suffixes = [
    /\s+using\s+(html|css|js|javascript|react|vue|vanilla).*$/i,
    /\s+gather\s+info\s+first.*$/i,
    /\s+gather\s+information\s+first.*$/i,
    /\s+search\s+first.*$/i,
    /\s+use\s+real\s+images.*$/i,
    /\s+(make|create|generate|build|design)\s+a?\s*(portfolio\s+)?(website|webpage|page|app|profile|portfolio|resume|cv).*$/i
  ];

  for (const regex of suffixes) {
    query = query.replace(regex, "");
  }

  return query.trim();
}

export const searchAgent = async (state) => {
  console.log("--- SEARCH AGENT ---");
  try {
    const searchQuery = cleanSearchQuery(state.prompt);
    console.log(`Cleaned Search Query: "${searchQuery}"`);

    const results = await Search_tool.invoke({ query: searchQuery });

    if (results.error) {
      console.error("Tavily Search API Error:", results.error);
      return {
        searchResults: "Error in fetching the search results: " + results.error,
        images: [],
      };
    }

    console.log("Search Results:", results);

    let extractedImages = results.images || [];
    if (extractedImages.length === 0 && Array.isArray(results.results)) {
      results.results.forEach(res => {
        if (Array.isArray(res.images)) {
          res.images.forEach(img => {
            if (typeof img === "string" && img.startsWith("http")) {
              extractedImages.push(img);
            } else if (img && typeof img === "object" && typeof img.url === "string" && img.url.startsWith("http")) {
              extractedImages.push(img.url);
            }
          });
        }
      });
    }

    // duplicates clean
    extractedImages = [...new Set(extractedImages)];

    return {
      searchResults: results.results || [],
      images: extractedImages,
    };
  } catch (error) {
    console.error("Search agent execution failed:", error);
    return {
      searchResults: "Error in fetching the search results",
      images: [],
    };
  }
};
