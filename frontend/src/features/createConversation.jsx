import api from "../utils/api";

const createConversation = async () => {
  try {
    const response = await api.post("/api/chat/create-conversation");
    return response.data?.data;
  } catch (error) {
    console.error("Create conversation error:", error);
    return null;
  }
};

export default createConversation;
