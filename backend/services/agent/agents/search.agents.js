import Search_tool from "../config/tavily.js";

// cleanSearchQuery — Prompt se actionable search subject extract karna.
// Problem: User prompt me instructions hote hain ("generate", "create", "make a pdf") jo search engines confuse ho jaate hain.
// Solution: Conversational prefixes, document/file suffixes aur filler phrases regex se strip karo.
// Result: "make a portfolio website for Elon Musk" => "Elon Musk"
export function cleanSearchQuery(prompt) {
  if (!prompt) return "";
  let query = prompt.trim();

  // Conversational filler phrases prompt ke shuru se remove karo (case-insensitive)
  const convoPrefixes = /^(can\s+you\s+|please\s+|could\s+you\s+|i\s+want\s+to\s+|i\s+need\s+to\s+|i\s+need\s+a\s+|write\s+a\s+|give\s+me\s+a\s+|give\s+me\s+|show\s+me\s+a\s+|show\s+me\s+|tell\s+me\s+about\s+)/i;
  query = query.replace(convoPrefixes, "").trim();
  
  // Action + document type + topic pattern strip karna
  // Example: "search for pdf about climate change" => "climate change"
  const prefixes = [
    /^(generate|make|create|build|design|search\s+for|search|google|find|lookup|look\s+up|gather\s+info\s+about|gather\s+info\s+for|gather\s+information\s+about|gather\s+information\s+for|who\s+is|biography\s+of|bio\s+of)\s+a\s+(portfolio\s+)?(website|webpage|page|app|profile|portfolio|resume|cv|pdf|presentation|presntation|presenation|presentaton|ppt|pptx|deck|slides|slide|slideshow|document|file)\s+(for|about|on|of)\s+/i,
    /^(generate|make|create|build|design|search\s+for|search|google|find|lookup|look\s+up|gather\s+info\s+about|gather\s+info\s+for|gather\s+information\s+about|gather\s+information\s+for|who\s+is|biography\s+of|bio\s+of)\s+(portfolio\s+)?(website|webpage|page|app|profile|portfolio|resume|cv|pdf|presentation|presntation|presenation|presentaton|ppt|pptx|deck|slides|slide|slideshow|document|file|celebrity|adult\s+star)\s+(for|about|of|on)\s+/i,
    /^(pdf|document|file|resume|cv|ppt|pptx|presentation|presntation|presenation|presentaton|deck|slides|slide|slideshow)\s+(on|about|of|for)\s+/i,
    /^(generate|make|create|build|design|search\s+for|search|google|find|lookup|look\s+up|gather\s+info\s+about|gather\s+info\s+for|gather\s+information\s+about|gather\s+information\s+for|who\s+is|biography\s+of|bio\s+of)\s+/i
  ];

  // Sirf pehla matching prefix hi remove karo, baaki sab chhoddo (break on first match)
  for (const regex of prefixes) {
    if (regex.test(query)) {
      query = query.replace(regex, "");
      break;
    }
  }

  // Trailing context suffixes strip karo
  // Example: "Elon Musk using html css" => "Elon Musk"
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

    // Tavily kabhi images top-level me deta hai, kabhi individual results ke andar — dono handle kiye hain.
    // Agar results[].images me bhi objects aate hain (url property ke saath), unhe bhi extract karo.
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

    // Set se duplicates remove karo — ek hi image URL baar baar show nahi honi chahiye
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
