import api from "../utils/api";

const getConversations = async () => {
  try {
    const response = await api.get("/api/chat/get-conversations");
    return response.data?.data || [];
  } catch (error) {
    console.error("Get conversations error:", error);
    return [];
  }
};

export default getConversations;
