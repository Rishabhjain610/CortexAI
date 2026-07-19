import api from "../utils/api";

// Backend endpoint trigger to initiate a Razorpay order creation for premium plans
const createBillingOrder = async (planKey) => {
  try {
    const response = await api.post("/api/billing/create-order", { plan: planKey });
    return response.data;
  } catch (error) {
    console.error("Create billing order error:", error);
    throw error;
  }
};

export default createBillingOrder;
