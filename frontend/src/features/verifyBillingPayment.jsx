import api from "../utils/api";

// Backend endpoint trigger to verify Razorpay signature tokens after payment completion
const verifyBillingPayment = async (payload) => {
  try {
    const response = await api.post("/api/billing/verify-payment", payload);
    return response.data;
  } catch (error) {
    console.error("Verify billing payment error:", error);
    throw error;
  }
};

export default verifyBillingPayment;
