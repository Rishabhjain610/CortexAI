import api from "../utils/api";

// Active user session authentication check karne ka endpoint trigger.
const getCurrentUser = async () => {
    try {
        const response = await api.get('api/me');
        return response.data.user;
    } catch (error) {
        console.error("GetMe error:", error);
        return null;
    }
}
export default getCurrentUser;