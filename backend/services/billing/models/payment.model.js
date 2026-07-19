import mongoose from "mongoose";
const paymentSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: false,
    },
    userId: {
      type: String,
      required: true,
    },
    orderId: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      enum: ["INR", "USD"],
      required: true,
    },
    credits: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    plan: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
export const Payment = mongoose.model("Payment", paymentSchema);
