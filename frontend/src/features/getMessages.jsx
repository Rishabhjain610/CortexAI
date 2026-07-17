import api from "../utils/api";

// Kisi specific conversation ke logs aur messages list download karne wala call.
const getMessages = async (conversationId) => {
  try {
    const response = await api.get(`/api/chat/get-messages/${conversationId}`);
    return response.data?.data || [];
  } catch (error) {
    console.error("Get messages error:", error);
    return [];
  }
};

export default getMessages;
