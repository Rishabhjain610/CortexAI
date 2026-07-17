import api from "../utils/api";

// User ki saari previous conversations history list backend se download karne wala wrapper function.
const getConversations = async () => {
  try {
    // timestamp append kiya hai taaki request browser side pe cache na ho.
    const response = await api.get(`/api/chat/get-conversations?t=${Date.now()}`);
    return response.data?.data || [];
  } catch (error) {
    console.error("Get conversations error:", error);
    return [];
  }
};

export default getConversations;
