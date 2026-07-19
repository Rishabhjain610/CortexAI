import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";
import { uploadToS3 } from "../utils/uploadToS3.js";
import { generatePptx } from "../utils/generatePptx.js";
import Search_tool from "../config/tavily.js";
import { cleanSearchQuery } from "./search.agents.js";

// PPT Agent Node: User prompt ke base par search karta hai aur download ke liye premium (.pptx) file generate karta hai
export const pptAgent = async (state) => {
  console.log("--- PPT AGENT ---");
  const llm = getModel("pptAgent");

  // ─── Step 1: Web search results fetch karo (agar pehle search na hua ho) ───────────────
  let searchResults = state.searchResults || [];
  if (!Array.isArray(searchResults) || searchResults.length === 0) {
    try {
      const searchQuery = cleanSearchQuery(state.prompt);
      console.log(`PPT Agent: Web search query: "${searchQuery}"`);
      const results = await Search_tool.invoke({ query: searchQuery });
      if (results && Array.isArray(results.results)) {
        searchResults = results.results;
      }
    } catch (err) {
      console.error("PPT Agent: Web search failed:", err.message);
    }
  }

  // ─── Step 2: Search results context format karo ───────────────────────────
  const formattedResults = searchResults.length > 0
    ? searchResults
        .slice(0, 5)
        .map((r, i) => `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
        .join("\n\n")
    : "No search results found.";

  // ─── Step 3: PPT system prompt define karo ───────────────────────────
  const systemPrompt = `You are CortexAI Presentation Designer, an expert PowerPoint presentation content writer and slide layout specialist.
Your goal is to output a well-structured, professional, and visually appealing PowerPoint presentation outline in JSON format based on the topic and search context.

OUTPUT: Only raw JSON. No markdown, no explanation, no code blocks. Double quotes only. No trailing commas.

JSON SCHEMA:
{
  "title": "Presentation Main Title",
  "subtitle": "Short descriptive subtitle",
  "author": "CortexAI or Author Name",
  "theme": {
    "primaryColor": "#6366F1", 
    "textColor": "#FFFFFF",
    "backgroundColor": "#0F172A"
  },
  "slides": [
    {
      "title": "Slide Title",
      "type": "bullets",
      "content": {
        "items": ["Key point 1", "Key point 2", "Key point 3"]
      }
    },
    {
      "title": "Slide Title",
      "type": "two-column",
      "content": {
        "leftColumn": {
          "title": "Left Section Title",
          "items": ["Bullet point A", "Bullet point B"]
        },
        "rightColumn": {
          "title": "Right Section Title",
          "text": "Alternative narrative paragraph summarizing findings."
        }
      }
    },
    {
      "title": "Slide Title",
      "type": "metrics",
      "content": {
        "metrics": [
          { "number": "85%", "label": "Accuracy improvement" },
          { "number": "10M+", "label": "Active monthly transactions" },
          { "number": "3.5x", "label": "Faster query response times" }
        ]
      }
    },
    {
      "title": "Slide Title",
      "type": "quote",
      "content": {
        "quote": {
          "text": "A key highlight, takeaway, or powerful quotation.",
          "author": "Person Name or Source"
        }
      }
    }
  ]
}

SLIDE RULES:
1. Generate 5-7 slides following the logical flow of the topic.
2. Select a suitable hex color code theme for primaryColor, textColor, and backgroundColor matching the topic (e.g. green/forest colors for environmental topics, blue/indigo for tech, corporate, etc.).
3. Choose the appropriate "type" for each slide:
   - "bullets": For lists, agendas, overview.
   - "two-column": For comparisons, side-by-side analysis, pros/cons.
   - "metrics": For dashboards, key statistics, numbers. Use max 3 metrics.
   - "quote": For highlighting a critical quote or single main takeaway.
   - "text": For simple descriptive slides with paragraph content.
4. DO NOT write generic placeholders like "Lorem Ipsum". Research the topic from the search context and write copy-edited, concise slide texts.`;

  // ─── Step 4: LLM API request ──────────────────────────────────────────────
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Topic: ${state.prompt}\n\n` +
      `Search Context:\n${formattedResults}\n\n` +
      `Generate the presentation JSON now.`
    ),
  ];

  const response = await llm.invoke(messages);
  let rawContent = (response.content || "").trim();

  // ─── Step 5: JSON extraction aur parsing/repair ───────────────────────────
  const extractJsonObject = (text) => {
    let cleaned = text;
    // Unclosed aur closed think blocks remove karo
    const thinkStart = cleaned.toLowerCase().indexOf("<think>");
    if (thinkStart !== -1) {
      const thinkEnd = cleaned.toLowerCase().indexOf("</think>");
      if (thinkEnd !== -1) {
        cleaned = cleaned.substring(thinkEnd + 8);
      } else {
        cleaned = cleaned.substring(0, thinkStart);
      }
    }
    
    // Find the first '{' that likely starts the presentation JSON object
    let startIdx = -1;
    let pos = 0;
    while ((pos = cleaned.indexOf("{", pos)) !== -1) {
      const sub = cleaned.substring(pos, pos + 200).toLowerCase();
      if (sub.includes('"title"') || sub.includes('"slides"') || sub.includes('title') || sub.includes('slides')) {
        startIdx = pos;
        break;
      }
      pos++;
    }
    
    if (startIdx === -1) {
      startIdx = cleaned.indexOf("{");
    }
    
    if (startIdx === -1) return null;
    
    // Balance braces to find matching '}'
    let bracketCount = 0;
    let inString = false;
    let escape = false;
    for (let i = startIdx; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (escape) { escape = false; continue; }
      if (char === "\\") { escape = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (!inString) {
        if (char === "{") {
          bracketCount++;
        } else if (char === "}") {
          bracketCount--;
          if (bracketCount === 0) {
            return cleaned.substring(startIdx, i + 1);
          }
        }
      }
    }
    
    // Fallback: use lastindexOf('}')
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > startIdx) {
      return cleaned.substring(startIdx, lastBrace + 1);
    }
    return null;
  };

  const repairJson = (s) => {
    let c = s.trim();
    c = c.replace(/,\s*([}\]])/g, "$1");
    c = c.replace(/([{,]\s*)'([^'\n]+)'\s*:/g, '$1"$2":');
    c = c.replace(/:\s*'([^'\n]*)'/g, ': "$1"');
    c = c.replace(/([\[,]\s*)'([^'\n]*)'/g, '$1"$2"');
    c = c.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    return c;
  };

  let extractedJson = extractJsonObject(rawContent);
  if (!extractedJson) {
    extractedJson = rawContent;
  }

  let parsedData = null;
  try {
    parsedData = JSON.parse(extractedJson);
  } catch {
    try {
      parsedData = JSON.parse(repairJson(extractedJson));
    } catch (err) {
      console.error("PPT Agent: JSON parsing failed. Content preview:", extractedJson.substring(0, 400));
      return { aiResponse: "PPT generation failed: could not parse presentation outline.", ppt: null };
    }
  }

  // ─── Step 6: PowerPoint presentation generate karo ───────────────────────────
  let s3Url = null;
  try {
    const pptxBuffer = await generatePptx(parsedData);

    // ─── Step 7: S3 pe upload karo ───────────────────
    const filename = `presentation-${Date.now()}.pptx`;
    s3Url = await uploadToS3(filename, pptxBuffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    console.log("PPT Agent: Uploaded PPTX to S3:", s3Url);
  } catch (err) {
    console.error("PPT Agent: PPTX generation or S3 upload failed:", err.message);
    return { aiResponse: `PPTX generation failed: ${err.message}`, ppt: null };
  }

  const title = parsedData?.title || "Presentation";
  console.log(`PPT Agent: "${title}" generated and uploaded successfully.`);

  let llmInfo = `[LLM Called: Ollama (Minimax) for presentation task.]`;
  if (searchResults.length > 0) {
    llmInfo += `\n[Web Search Executed: Found ${searchResults.length} results]`;
  }

  return {
    aiResponse: `<think>${llmInfo}</think>\n` +
      `✅ PowerPoint Presentation ready: **${title}**\n\n` +
      `[📊 Download PPTX Presentation](${s3Url})`,
    ppt: s3Url,
  };
};

