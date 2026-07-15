const sendMessage = async (conversationId, prompt, options = {}, onChunk) => {
  try {
    const response = await fetch("http://localhost:8000/api/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ conversationId, prompt, ...options }),
    });

    if (response.status !== 200) {
      const errText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error("No response body available for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Save the last partial line back to the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.startsWith("data: ")) {
          const dataStr = cleanLine.slice(6).trim();
          if (dataStr === "[DONE]") return;
          
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              onChunk(parsed.text);
            }
          } catch (e) {
            // Wait for full chunk if parse fails
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
