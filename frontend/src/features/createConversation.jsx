import api from "../utils/api";

// Backend API call karke database me ek blank new conversation room/document create karne ka feature helper.
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
