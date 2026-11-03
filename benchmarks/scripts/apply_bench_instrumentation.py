import re

def update_file(path, fn):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    new_content = fn(content)
    if new_content != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {path}")
    else:
        print(f"No changes made to {path}")

# 1. model.js
def patch_model_js(s):
    # Support GEMINI_MODEL and GEMINI_API_KEY_FALLBACK
    old_gemini = re.search(r'export const gemini = new ChatGoogleGenerativeAI\(\{[\s\S]*?\}\);', s)
    if old_gemini:
        replacement = """export const gemini = new ChatGoogleGenerativeAI({
  model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  apiKey: process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_FALLBACK,
  maxRetries: 3,
});"""
        s = s[:old_gemini.start()] + replacement + s[old_gemini.end():]
    return s

update_file("backend/services/agent/config/model.js", patch_model_js)

# 2. router.js
def patch_router_js(s):
    if "[BENCH_TRACE]" in s:
        return s
    helper = """
const routeReturn = (targetAgent, layer, meta = {}) => {
  if (process.env.BENCH_MODE === "1") {
    console.log(`[BENCH_TRACE] [router] Layer: ${layer} | Result: ${targetAgent} | Meta: ${JSON.stringify(meta)}`);
  }
  return { agent: targetAgent };
};
"""
    # Put helper right before router export
    s = s.replace("export const router = async (state) => {", helper + "\nexport const router = async (state) => {")
    s = s.replace('return { agent: "pdfRagAgent" };', 'return routeReturn("pdfRagAgent", "Layer 1/1.5", { reason: "file/manual" });')
    s = s.replace('return { agent };', 'return routeReturn(agent, "Layer 1", { reason: "manual" });')
    s = s.replace('return { agent: "imageAnalyzer" };', 'return routeReturn("imageAnalyzer", "Layer 1.5", { reason: "image-file" });')
    s = s.replace('return { agent: "imageAgent" };', 'return routeReturn("imageAgent", "Layer 2", { reason: "image-keyword" });')
    s = s.replace('return { agent: "searchAgent" };', 'return routeReturn("searchAgent", "Layer 2", { reason: "search-keyword" });')
    s = s.replace('return { agent: "codingAgent" };', 'return routeReturn("codingAgent", "Layer 2", { reason: "coding-keyword" });')
    s = s.replace('return { agent: "pptAgent" };', 'return routeReturn("pptAgent", "Layer 2", { reason: "ppt-keyword" });')
    s = s.replace('return { agent: "chatAgent" };', 'return routeReturn("chatAgent", "Layer 2/Fallback", { reason: "chat-keyword" });')
    s = s.replace('return { agent: "pdfAgent" };', 'return routeReturn("pdfAgent", "Layer 2", { reason: "pdf-keyword" });')
    s = s.replace('return { agent: targetAgent };', 'return routeReturn(targetAgent, "Layer 3: LLM", { reason: "llm-classified" });')
    return s

update_file("backend/services/agent/graph/router.js", patch_router_js)

# 3. pdfRag.agent.js
def patch_pdf_rag_agent(s):
    if "[BENCH_TRACE]" in s:
        return s
    
    # Locate const response = await llm.invoke(messages);
    old_invoke = "const response = await llm.invoke(messages);"
    new_invoke = """const _t_gen_start = Date.now();
    const response = await llm.invoke(messages);
    const _genLatencyMs = Date.now() - _t_gen_start;

    if (process.env.BENCH_MODE === "1") {
      const tokenUsage = response.usage_metadata || response.response_metadata?.tokenUsage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      console.log(`[BENCH_TRACE] [pdfRagAgent] Query: "${query.slice(0, 50)}" | Retrieved: ${relevantdocs.length} chunks | Model: ${llm.model || llm.modelName || "gemini-3.1-flash-lite"} | Tokens: ${JSON.stringify(tokenUsage)} | Latencies: embed=${typeof _embedLatencyMs !== "undefined" ? _embedLatencyMs : 0}ms, search=${typeof _searchLatencyMs !== "undefined" ? _searchLatencyMs : 0}ms, gen=${_genLatencyMs}ms`);
    }"""
    if old_invoke in s:
        # replace the last occurrence (main branch)
        last_idx = s.rfind(old_invoke)
        s = s[:last_idx] + new_invoke + s[last_idx + len(old_invoke):]
    return s

update_file("backend/services/agent/agents/pdfRag.agent.js", patch_pdf_rag_agent)

# 4. agent.controller.js
def patch_agent_controller(s):
    if "[BENCH_TRACE]" in s:
        return s
    marker = 'console.log("req.body received in agent controller:", req.body);'
    addition = """
    if (process.env.BENCH_MODE === "1") {
      console.log(`[BENCH_TRACE] [agentController] User: ${req.headers["x-user-id"] || "anon"} | Target: ${selectedAgent || "auto"} | Prompt: "${(req.body.prompt || "").slice(0, 50)}"`);
    }"""
    if marker in s:
        s = s.replace(marker, marker + addition)
    return s

update_file("backend/services/agent/controller/agent.controller.js", patch_agent_controller)

# 5. ipRateLimiter.js
def patch_rate_limiter(s):
    if "[BENCH_TRACE]" in s:
        return s
    marker = 'if (count > DEFAULT_LIMIT) {'
    addition = """    if (process.env.BENCH_MODE === "1") {
      console.log(`[BENCH_TRACE] [ipRateLimiter] IP: ${clientIp} | Count: ${count} / ${DEFAULT_LIMIT} | Allowed: ${count <= DEFAULT_LIMIT}`);
    }
    """
    if marker in s:
        s = s.replace(marker, addition + marker)
    return s

update_file("backend/gateway/middleware/ipRateLimiter.js", patch_rate_limiter)

# 6. billing.controller.js
def patch_billing_controller(s):
    if "[BENCH_TRACE]" in s:
        return s
    marker = 'return res.status(409).json({'
    addition = """if (process.env.BENCH_MODE === "1") {
        console.log(`[BENCH_TRACE] [billingVerify] Order: ${razorpay_order_id} | Status: 409_ALREADY_PROCESSED`);
      }
      """
    if marker in s:
        s = s.replace(marker, addition + marker)
    
    marker_success = 'return res.status(200).json({'
    addition_success = """if (process.env.BENCH_MODE === "1") {
      console.log(`[BENCH_TRACE] [billingVerify] Order: ${razorpay_order_id} | Status: 200_SUCCESS_CREDITED`);
    }
    """
    if marker_success in s:
        s = s.replace(marker_success, addition_success + marker_success)
    return s

update_file("backend/services/billing/controller/billing.controller.js", patch_billing_controller)
print("Done patching backend instrumentation.")
