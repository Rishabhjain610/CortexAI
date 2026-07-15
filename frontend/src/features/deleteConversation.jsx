import api from "../utils/api";

const deleteConversation = async (conversationId) => {
  try {
    const response = await api.delete(
      `/api/chat/delete-conversation/${conversationId}`,
    );
    return response.data?.data;
  } catch (error) {
    console.error("Delete conversation error:", error);
    return null;
  }
};

export default deleteConversation;
