import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";
import generatePdf from "../utils/generatePdf.js";
import { uploadToS3 } from "../utils/uploadToS3.js";
import Search_tool from "../config/tavily.js";
import { cleanSearchQuery } from "./search.agents.js";

// PDF Agent Node: User ke prompt ke liye web search karta hai, JSON banata hai, PDF generate karta hai, S3 pe upload karta hai
export const pdfAgent = async (state) => {
  console.log("--- PDF AGENT ---");
  const llm = getModel("pdfAgent"); // LLaMA 3.3-70b (non-thinking model)

  // ─── Step 1: Web search results fetch karo ─────────────────────────────────
  // Agar searchAgent pehle se results de chuka hai toh reuse karo, warna khud search karo
  let searchResults = state.searchResults || [];
  if (!Array.isArray(searchResults) || searchResults.length === 0) {
    try {
      const searchQuery = cleanSearchQuery(state.prompt);
      console.log(`PDF Agent: Web search query: "${searchQuery}"`);
      const results = await Search_tool.invoke({ query: searchQuery });
      if (results && Array.isArray(results.results)) {
        searchResults = results.results;
      }
    } catch (err) {
      console.error("PDF Agent: Web search failed:", err.message);
    }
  }

  // ─── Step 2: Search results ko readable format me convert karo ─────────────
  const formattedResults = searchResults.length > 0
    ? searchResults
        .slice(0, 5) // Sirf top 5 results use karo — token limit control ke liye
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
        .join("\n\n")
    : "No search results found.";

  // ─── Step 3: System prompt — simple schema, strict limits ──────────────────
  // Sirf 3 content types: paragraph, bullets, infobox — no tables, no charts, no images
  const systemPrompt = `You are a PDF content writer. Create a well-structured, informative document from the given topic and search context.

OUTPUT: Only raw JSON. No markdown, no explanation, no code blocks. Double quotes only. No trailing commas.

LIMITS:
- Max 5 sections
- Each section: 1 content block (paragraph OR bullets OR infobox)
- Paragraph: max 80 words
- Bullets: max 8 short items
- Infobox: max 10 key-value pairs
- coverImage: optional URL string (include ONLY if a good image URL exists in search context)

JSON SCHEMA:
{
  "title": "Document Title",
  "subtitle": "Short subtitle",
  "author": "Source or author",
  "primaryColor": "#1e3a8a",
  "coverImage": "https://example.com/image.jpg",
  "sections": [
    {
      "heading": "Overview",
      "content": {
        "type": "paragraph",
        "text": "A concise paragraph about the topic."
      }
    },
    {
      "heading": "Key Facts",
      "content": {
        "type": "infobox",
        "pairs": [
          { "key": "Born", "value": "September 16, 1981" },
          { "key": "Nationality", "value": "French-American" }
        ]
      }
    },
    {
      "heading": "Career Highlights",
      "content": {
        "type": "bullets",
        "items": ["Item one with detail", "Item two", "Item three"]
      }
    }
  ]
}

Use infobox for biographical facts and dates, bullets for achievements/lists, paragraph for narrative overviews. Be informative and factual.`;

  // Search results me se pehli image URL extract karo (agar hai toh)
  let firstImageUrl = null;
  if (Array.isArray(state.images) && state.images.length > 0) {
    firstImageUrl = state.images.find(img => typeof img === "string" && img.startsWith("http"));
  }
  if (!firstImageUrl && Array.isArray(searchResults)) {
    firstImageUrl = searchResults
      .flatMap(r => r.images || [])
      .find(img => typeof img === "string" && img.startsWith("http")) || null;
  }



  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Topic: ${state.prompt}\n\n` +
      `Search context:\n${formattedResults}\n\n` +
      (firstImageUrl ? `Available image URL (use as coverImage if relevant): ${firstImageUrl}\n\n` : "") +
      `Generate the JSON now.`
    ),
  ];

  // ─── Step 4: LLM se structured JSON le rahe hain ───────────────────────────
  const response = await llm.invoke(messages);
  let rawContent = (response.content || "").trim();

  // <think>...</think> blocks strip karo (agar koi reasoning model galti se use hua)
  rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  rawContent = rawContent.replace(/<\/think>/gi, "").trim();

  // Markdown code block wrappers hata do agar hain
  rawContent = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  rawContent = rawContent.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();

  // Pehle { se aakhri } tak extract karo (safest extraction)
  const firstBrace = rawContent.indexOf("{");
  const lastBrace  = rawContent.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    rawContent = rawContent.substring(firstBrace, lastBrace + 1);
  }

  // ─── Step 5: JSON parse karo (2-step: direct → repair) ─────────────────────
  const repairJson = (s) => {
    let c = s.trim();
    c = c.replace(/,\s*([}\]])/g, "$1");                           // Trailing commas hata do
    c = c.replace(/([{,]\s*)'([^'\n]+)'\s*:/g, '$1"$2":');        // Single-quote keys fix
    c = c.replace(/:\s*'([^'\n]*)'/g, ': "$1"');                   // Single-quote values fix
    c = c.replace(/([\[,]\s*)'([^'\n]*)'/g, '$1"$2"');            // Array single-quotes fix
    c = c.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":'); // Unquoted keys fix
    return c;
  };

  let parsedData = null;
  try {
    parsedData = JSON.parse(rawContent);
  } catch {
    try {
      parsedData = JSON.parse(repairJson(rawContent));
    } catch (err) {
      console.error("PDF Agent: JSON parse failed. Preview:", rawContent.substring(0, 400));
      return { aiResponse: "PDF generation failed: could not parse document structure.", pdf: null };
    }
  }

  // ─── Step 6: PDF buffer generate karo ──────────────────────────────────────
  let s3Url = null;
  try {
    const pdfBuffer = await generatePdf(parsedData);

    // ─── Step 7: S3 pe upload karo aur presigned URL wapas lo ────────────────
    const filename = `pdf-${Date.now()}.pdf`;
    s3Url = await uploadToS3(filename, pdfBuffer, "application/pdf");
    console.log("PDF Agent: Uploaded to S3:", s3Url);
  } catch (err) {
    console.error("PDF Agent: PDF generation or S3 upload failed:", err.message);
    return { aiResponse: `PDF generation failed: ${err.message}`, pdf: null };
  }

  const title = parsedData?.title || "Document";
  console.log(`PDF Agent: "${title}" generated and uploaded successfully.`);

  return {
    // aiResponse me PDF ka title aur download link dono hain
    aiResponse: `✅ PDF ready: **${title}**\n\n[📄 Download PDF](${s3Url})`,
    pdf: s3Url, // S3 presigned URL — blob nahi
  };
};
