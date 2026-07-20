// Agent backend API se live AI response streams consume karne wala helper.
const sendMessage = async (conversationId, prompt, options = {}, onChunk) => {
  try {
// File present hone par FormData (multipart/form-data) use karo, warna plain JSON.
// Reason: File binary data ko JSON me encode nahi kar sakte. Browser FormData boundary automatically set karta hai.
// Content-Type header manually set NAHI karna kyunki browser boundary string khud include karta hai FormData ke liye.
    const { file, ...restOptions } = options;
    let body, headers;
    if (file) {
      const fd = new FormData();
      fd.append("conversationId", conversationId);
      fd.append("prompt", prompt || "");
      fd.append("file", file);
      // restOptions me agent selection, model, etc. ho sakta hai — sab kuch FormData me append karo
      Object.entries(restOptions).forEach(([k, v]) => v != null && fd.append(k, v));
      body = fd;
      headers = {}; // Browser Content-Type + boundary automatically set karta hai
    } else {
      body = JSON.stringify({ conversationId, prompt, ...restOptions });
      headers = { "Content-Type": "application/json" };
    }

    const response = await fetch("http://localhost:8000/api/agent/chat", {
      method: "POST",
      headers,
      credentials: "include",
      body,
    });

    if (response.status !== 200) {
      const errText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error("No response body available for streaming");
    }

    // Server-sent events (SSE) stream reader setup.
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    // SSE stream lines parse karne ka main loop.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break; // Stream close ho gaya — connection end

      // TextDecoder stream:true mode me partial UTF-8 sequences handle karta hai across chunks
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Aakhri adhoori line ko buffer me bacha lete hain taaki agle chunk me merge ho sake.
      // Example: agar "data: {\"text\": \"hell" aya toh next chunk se "o"}" milega — dono combine hone chahiye.
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.startsWith("data: ")) {
          const dataStr = cleanLine.slice(6).trim();
          // [DONE] string — backend ka signal ki stream complete ho gaya, function return karo
          if (dataStr === "[DONE]") return;
          
          try {
            const parsed = JSON.parse(dataStr);
            // Agar parsed object me naya text, image, ya artifact hai toh callback trigger karo
            // Error chunks (parsed.error) intentionally ignore kiye hain — ChatArea me error state alag handle hoti hai
            if (parsed.text || parsed.images || parsed.artifacts || parsed.pdf) {
              onChunk(parsed);
            }
          } catch (e) {
            // JSON.parse fail hone par silently ignore karo — partial chunk ho sakta hai next read me complete hoga
          }
        }
      }
    }
  } catch (error) {
    console.error("Stream reading error:", error);
    throw error;
  }
};

export default sendMessage;
