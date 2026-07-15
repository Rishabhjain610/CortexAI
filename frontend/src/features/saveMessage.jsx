import api from "../utils/api";

const saveMessage = async (conversationId, content, role) => {
  try {
    const response = await api.post("/api/chat/save-message", {
      conversationId,
      content,
      role: role || "user",
    });
    return response.data?.data;
  } catch (error) {
    console.error("Save message error:", error);
    return null;
  }
};

export default saveMessage;
