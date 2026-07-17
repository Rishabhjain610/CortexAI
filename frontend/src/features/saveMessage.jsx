import api from "../utils/api";

// Naya user message ya generated AI response database me persistent save karne ka call.
const saveMessage = async (conversationId, content, role, images = [], artifacts = []) => {
  try {
    const response = await api.post("/api/chat/save-message", {
      conversationId,
      content,
      role: role || "user",
      images,
      artifacts,
    });
    return response.data?.data;
  } catch (error) {
    console.error("Save message error:", error);
    return null;
  }
};

export default saveMessage;
