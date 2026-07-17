// Agent backend API se live AI response streams consume karne wala helper.
const sendMessage = async (conversationId, prompt, options = {}, onChunk) => {
  try {
    const response = await fetch("http://localhost:8000/api/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Sessions authentication cookies include kar rahe hain.
      body: JSON.stringify({ conversationId, prompt, ...options }),
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

    // Stream lines parse karne ka main loop.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Aakhri adhoori line ko buffer me bacha lete hain taaki agle chunk me merge ho sake.
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.startsWith("data: ")) {
          const dataStr = cleanLine.slice(6).trim();
          if (dataStr === "[DONE]") return;
          
          try {
            const parsed = JSON.parse(dataStr);
            // Agar parsed object me naya text, image, ya artifact hai toh callback function trigger karte hain.
            if (parsed.text || parsed.images || parsed.artifacts) {
              onChunk(parsed);
            }
          } catch (e) {
            // Agar parse fail ho toh agle chunk aane ka wait karte hain.
          }
        }
      }
    }
  } catch (error) {
    console.error("Stream reading error:", error);
    return null;
  }
};

export default sendMessage;
