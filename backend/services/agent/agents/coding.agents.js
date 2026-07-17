import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../config/model.js";

// Coding Agent Node: User ke code-related questions, creation, review, and optimization ko process karne wala agent.
export const codingAgent = async (state) => {
  console.log("--- CODING AGENT ---");
  const intentllm = getModel("intent");
  
  // Intent classifier prompt: Isse user ki request ka main target category pata chalega.
  const intentPrompt = `You are a coding assistant's intent classifier.
Analyze the user's software engineering prompt and classify its primary intent into exactly one of the following categories:
1. "code_generation": When the user asks to write new code, functions, classes, scripts, HTML/CSS, or database queries.
2. "code_review": When the user wants code reviewed for style, logic, security, bugs, or quality.
3. "code_explanation": When the user asks how a piece of code works, what an API does, or needs code walkthroughs.
4. "debugging": When the user provides an error message, stack trace, or buggy code and wants help fixing it.
5. "optimization": When the user asks to make code faster, reduce memory footprint, refactor for efficiency, or optimize performance.
6. "conversation": When the user is having general tech talk, greeting you, asking meta-questions, or general programming chit-chat.
7. "documentation": When the user asks to write comments, docstrings, README files, API specifications, or explanation manuals.

Respond with ONLY the category name in lowercase (one of: code_generation, code_review, code_explanation, debugging, optimization, conversation, documentation). Do not include any other text, quotes, formatting, or explanation.`;

  const intentRes = await intentllm.invoke([
    new SystemMessage(intentPrompt),
    new HumanMessage(state.prompt)
  ]);
  
  let intent = intentRes.content;
  // DeepSeek ke thinking tags (<think>...</think>) ko saaf karte hain agar intent output me shamil ho.
  intent = intent.replace(/<(?:mm:)?think>[\s\S]*?<\/(?:mm:)?think>/gi, "");
  intent = intent.trim().toLowerCase().replace(/['"`]/g, "");
  console.log(`Classified Coding Intent: ${intent}`);

  let systemMessageText = "";
  // Intent ke classification ke mutabik system instructions adjust karte hain.
  switch (intent) {
    case "code_generation":
      systemMessageText = `You are a senior software architect specializing in code generation.
Create a responsive, modern, state-of-the-art web interface.

Rules:
1. Default to using vanilla HTML, CSS, and JS (vanilla JS) only. Use React, Vue, or other frameworks ONLY if the user explicitly specifies them in their prompt.
2. The UI must be modern and premium: use clean CSS variables, flexbox/grid layouts, beautiful hover effects, and micro-animations. It should be a single-page structure unless specified otherwise.
3. You MUST respond with ONLY a valid JSON object matching the following schema. Do NOT wrap the JSON in markdown code blocks, do not include any markdown, explanation, or conversational text. Output ONLY the raw JSON string:
{
  "files": [
    {
      "name": "index.html",
      "content": "..."
    },
    {
      "name": "style.css",
      "content": "..."
    },
    {
      "name": "script.js",
      "content": "..."
    }
  ]
}`;
      break;
    case "code_review":
      systemMessageText = `You are an expert code reviewer.
Analyze the code for bugs, edge cases, security issues, code smells, readability, and adherence to best practices.

Rules:
1. Never generate project files (do not output in JSON format).
2. Return your review as a standard markdown explanation containing an overview of best practices and feedback.
3. Provide optimized code inline in markdown code blocks only if it is actually needed for clarification.`;
      break;
    case "code_explanation":
      systemMessageText = "You are a clear and concise technical instructor. Break down the provided code step-by-step. Explain the logic, data flow, key algorithms, and design choices in simple, easy-to-understand terms.";
      break;
    case "debugging":
      systemMessageText = "You are an expert debugging assistant. Analyze the bug or error message provided. Identify the root cause of the failure, explain why it happens, and provide corrected code along with advice to prevent it in the future.";
      break;
    case "optimization":
      systemMessageText = "You are a performance tuning expert. Analyze the provided code for runtime complexity, memory utilization, and bottlenecks. Refactor and optimize it for speed, concurrency, and resource efficiency.";
      break;
    case "documentation":
      systemMessageText = "You are a professional technical writer. Write thorough documentation, including docstrings, inline comments, README guides, or API specs for the provided code. Ensure clarity, completeness, and clean formatting.";
      break;
    case "conversation":
    default:
      systemMessageText = "You are CortexAI, an intelligent software engineering assistant created by Rishabh Jain. Answer coding questions, discuss software architecture, and provide helpful guidance.";
      break;
  }

  // General text formatting rules set kar rahe hain.
  if (intent !== "code_generation") {
    systemMessageText += `

Formatting Rules:
1. DO NOT start the response with introductory filler or conversational preambles (such as "Sure, here is...", "Here is the explanation for...", "Let me help you debug...", "Here is the optimized code...", etc.). Jump directly into the content.
2. DO NOT include generic top-level headings (such as "# Code Review Findings", "# Explanation", "# Debugging", "# Optimized Code", "# Documentation", etc.) at the top of your response. Start directly with the actual content/findings.`;
  }

  // Model client compile karke invoke karte hain (fallback support models automatic handle ho jayenge).
  const llm = getModel("codingAgent");
  
  const messages = [
    new SystemMessage(systemMessageText),
    new HumanMessage(state.prompt),
  ];

  const streamOptions = {};
  if (intent === "code_generation") {
    streamOptions.response_format = { type: "json_object" };
  }

  const responseStream = await llm.stream(messages, streamOptions);

  let content = "";
  for await (const chunk of responseStream) {
    content += chunk.content;
  }

  let filesList = [];
  // Agar new code files generate ki gayi hain, toh JSON parse karke file list build karte hain.
  if (intent === "code_generation") {
    try {
      const parsed = JSON.parse(content.trim());
      if (parsed && Array.isArray(parsed.files)) {
        filesList = parsed.files;
      }
    } catch (e) {
      console.warn("Could not parse generated code JSON content:", e.message);
    }
  }

  return {
    aiResponse: content,
    artifacts: [
      {
        id: Date.now(),
        type: "Dhriti",
        files: filesList,
        title:state.prompt,
      }
    ]
  };
};
