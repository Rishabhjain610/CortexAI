import { SimpleChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";

class StubChatModel extends SimpleChatModel {
  constructor(agentName = "chatAgent", fields = {}) {
    super(fields);
    this.agentName = agentName;
  }

  _llmType() {
    return "cortexai_bench_stub_model";
  }

  _getCannedResponse(promptText = "") {
    if (this.agentName === "pdfAgent" || this.agentName === "pptAgent") {
      return JSON.stringify({
        title: "Benchmark Executive Summary",
        slides: [
          { title: "Performance", content: "System operating within nominal benchmark parameters." },
          { title: "Architecture", content: "Multi-agent cognitive orchestration verified." }
        ],
        sections: [
          { heading: "Executive Overview", text: "Verified under benchmark load." }
        ]
      });
    }
    if (this.agentName === "codingAgent") {
      return "```javascript\n// Benchmark verified algorithm\nfunction computeThroughput(reqs, sec) {\n  return reqs / sec;\n}\nmodule.exports = { computeThroughput };\n```";
    }
    return "<think>Analyzing benchmark request in stub mode.</think>\nThis is a benchmark canned response verifying throughput, routing, and cognitive pipeline stability.";
  }

  async _call(messages) {
    await new Promise((r) => setTimeout(r, 15)); // Simulated 15ms latency
    const lastMsg = messages[messages.length - 1]?.content || "";
    return this._getCannedResponse(typeof lastMsg === "string" ? lastMsg : JSON.stringify(lastMsg));
  }

  async *_streamResponseChunks(messages, options, runManager) {
    const lastMsg = messages[messages.length - 1]?.content || "";
    const responseText = this._getCannedResponse(typeof lastMsg === "string" ? lastMsg : JSON.stringify(lastMsg));

    const chunks = [
      "<think>Evaluating prompt in stub mode.</think>\n",
      responseText.slice(0, Math.floor(responseText.length / 2)),
      responseText.slice(Math.floor(responseText.length / 2))
    ];

    for (const chunkText of chunks) {
      await new Promise((r) => setTimeout(r, 5)); // Simulated chunk delay
      const chunk = new ChatGenerationChunk({
        message: new AIMessageChunk({ content: chunkText }),
        text: chunkText
      });
      yield chunk;
      await runManager?.handleLLMNewToken(chunkText);
    }
  }
}

export const getStubModel = (agentName) => {
  return new StubChatModel(agentName);
};

