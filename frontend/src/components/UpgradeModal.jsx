import React, { useState } from "react";
import { X, Sparkles, Check, Loader2 } from "lucide-react";
import createBillingOrder from "../features/createBillingOrder";
import verifyBillingPayment from "../features/verifyBillingPayment";

const PLANS_DATA = [
  {
    key: "free",
    name: "Free",
    price: "₹0",
    credits: 10,
    features: [
      "Access to basic chat agent",
      "10 request credits",
      "Standard response speed",
      "Local browser storage saving"
    ],
    buttonText: "Current Plan",
    disabled: true,
    popular: false,
    gradient: "from-gray-500/20 to-gray-700/20"
  },
  {
    key: "pro",
    name: "Pro Pack",
    price: "₹10",
    credits: 100,
    features: [
      "Access to all premium agents",
      "100 request credits",
      "Priority response speed",
      "Generate custom PDFs & presentations",
      "Early access to new features"
    ],
    buttonText: "Upgrade to Pro",
    disabled: false,
    popular: true,
    gradient: "from-indigo-600/30 to-purple-600/30"
  },
  {
    key: "business",
    name: "Business",
    price: "₹100",
    credits: 1000,
    features: [
      "All Pro Pack features",
      "1,000 request credits",
      "Ultra-fast processing",
      "Dedicated workspace support",
      "Custom system configurations"
    ],
    buttonText: "Buy Business Plan",
    disabled: false,
    popular: false,
    gradient: "from-amber-600/30 to-orange-600/30"
  }
];

const UpgradeModal = ({ isOpen, onClose, user, onSuccess }) => {
  const [loadingPlan, setLoadingPlan] = useState(null);

  if (!isOpen) return null;

  const handleUpgrade = async (planKey) => {
    try {
      setLoadingPlan(planKey);
      
      // 1. Create order on the backend using the feature
      const orderData = await createBillingOrder(planKey);
      const { orderId, plan, amount, currency } = orderData;

      // 2. Initialize Razorpay Checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: amount, // Received directly in paise from backend
        currency: currency,
        name: "CortexAI Workspace",
        description: `Upgrade to ${plan.name} Plan`,
        order_id: orderId,
        handler: async (response) => {
          try {
            setLoadingPlan(planKey);
            // 3. Verify payment on backend using the feature
            await verifyBillingPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            
            // Trigger success callback to reload profile details
            if (onSuccess) {
              onSuccess();
            }
            alert(`Congratulations! You have successfully upgraded to ${plan.name} plan.`);
            onClose();
          } catch (err) {
            console.error("Payment verification failed:", err);
            alert("Payment verification failed. If money was deducted, please contact support.");
          } finally {
            setLoadingPlan(null);
          }
        },
        theme: {
          color: "#7c7ec8",
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error) {
      console.error("Initiating upgrade failed:", error);
      alert(error.response?.data?.message || "Failed to initiate payment. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-[#141210] border border-white/[0.08] rounded-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-base-100">CortexAI Subscriptions</h2>
              <p className="text-xs text-base-450 mt-0.5">Upgrade your account to get more requests credits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-base-500 hover:text-base-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Status Summary */}
        {user && (
          <div className="px-6 py-3 bg-white/[0.01] border-b border-white/[0.04] flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base-400">Current Plan:</span>
              <span className="font-semibold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/25">
                {user.plan || "free"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-base-400">Available Credits:</span>
                <span className="font-semibold text-emerald-400">{user.credits ?? 100}</span>
              </div>
              <span className="text-white/[0.1]">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-base-400">Total Credits:</span>
                <span className="font-semibold text-base-200">{user.totalCredits ?? 100}</span>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 grid md:grid-cols-3 gap-6 align-stretch min-h-0">
          {PLANS_DATA.map((plan) => {
            const isCurrent = (user?.plan || "free") === plan.key;
            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-xl p-5 border bg-gradient-to-b ${plan.gradient} transition-all duration-300
                  ${plan.popular 
                    ? "border-indigo-500/40 shadow-[0_8px_30px_rgb(99,102,241,0.15)] scale-[1.02]" 
                    : "border-white/[0.06] hover:border-white/[0.12]"
                  }`}
              >
                {/* Popular Ribbon */}
                {plan.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-indigo-500 text-[10px] font-semibold text-white tracking-wide uppercase shadow">
                    Most Popular
                  </span>
                )}

                <div className="mb-4">
                  <h3 className="text-[15px] font-bold text-base-100">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2.5">
                    <span className="text-2xl font-extrabold text-base-100">{plan.price}</span>
                    {plan.key !== "free" && <span className="text-xs text-base-500 font-normal">/month</span>}
                  </div>
                  <p className="text-[11px] text-emerald-400 font-medium mt-1">
                    Includes {plan.credits} Credits
                  </p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-base-400 leading-normal">
                      <Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={plan.disabled || isCurrent || loadingPlan !== null}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 flex items-center justify-center gap-1.5
                    ${isCurrent
                      ? "bg-white/[0.04] text-base-500 border border-white/[0.05] cursor-default"
                      : plan.popular
                        ? "bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer hover:shadow-lg hover:shadow-indigo-500/10"
                        : "bg-white/[0.07] hover:bg-white/[0.12] text-base-200 border border-white/[0.07] cursor-pointer"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loadingPlan === plan.key ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <span>{isCurrent ? "Current Plan" : plan.buttonText}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;