import axios from "axios";
import crypto from "crypto";
import mongoose from "mongoose";
import { PLANS } from "../config/plans.js";
import { razorpay } from "../config/razorpay.js";
import { Payment } from "../models/payment.model.js";

export const createOrder = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const { plan } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: "User ID header is missing" });
    }
    if (!PLANS[plan]) {
      return res.status(400).json({ message: "Invalid Plan" });
    }

     const { amount } = PLANS[plan];
    
    // Dynamic unique receipt ID create karne ke liye
    const receiptId = new mongoose.Types.ObjectId().toString();
    
    // Razorpay API se naya checkout order create kiya
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100, // Razorpay paise me kaam karta hai
      currency: "INR",
      receipt: receiptId,
    });

    // Billing transaction history track karne ke liye details database me pending status ke sath save kiya
    await Payment.create({
      userId,
      orderId: razorpayOrder.id,
      amount: PLANS[plan].amount,
      currency: razorpayOrder.currency,
      credits: PLANS[plan].credits,
      plan: plan, // pro or business
      status: "PENDING",
    });

    return res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      plan: PLANS[plan],
    });
  } catch (error) {
    console.error("Order creation failed:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong in payment creation", error: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      console.error("RAZORPAY_KEY_SECRET is missing in environment variables");
      return res.status(500).json({ message: "Razorpay keys configuration error" });
    }

    // Signature verification check kar rahe hain
    const generateSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
      
    if (generateSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Atomic state transition: Only update if status is currently PENDING
    // This guarantees idempotency under concurrent or replayed payment verification requests
    const payment = await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id, status: "PENDING" },
      { $set: { status: "SUCCESS", transactionId: razorpay_payment_id } },
      { new: true }
    );

    if (!payment) {
      // Check if order was already successfully processed
      const existing = await Payment.findOne({ orderId: razorpay_order_id });
      if (existing && existing.status === "SUCCESS") {
        if (process.env.BENCH_MODE === "1") {
        console.log(`[BENCH_TRACE] [billingVerify] Order: ${razorpay_order_id} | Status: 409_ALREADY_PROCESSED`);
      }
      return res.status(409).json({
          message: "Payment has already been processed and credited",
          orderId: razorpay_order_id,
          status: "ALREADY_PROCESSED"
        });
      }
      return res.status(404).json({ message: "Payment order details not found" });
    }

    // Auth service call karke user ka updated plan aur credit balance database aur Redis memory me sync kiya
    const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
    try {
      const response = await axios.post(`${authServiceUrl}/update-payment`, {
        userId: payment.userId,
        plan: payment.plan,
        credits: payment.credits,
      });

      console.log("Successfully updated user payment status in Auth Service:", response.data);
    } catch (authError) {
      console.error(
        "Failed to make HTTP call to Auth service for payment update:",
        authError.response?.data || authError.message
      );
    }

    if (process.env.BENCH_MODE === "1") {
      console.log(`[BENCH_TRACE] [billingVerify] Order: ${razorpay_order_id} | Status: 200_SUCCESS_CREDITED`);
    }
    return res.status(200).json({ message: "Payment verification success", payment });
  } catch (error) {
    console.error("Payment verification failed:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong during verification", error: error.message });
  }
};

export const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!webhookSecret || !signature) {
      return res.status(400).json({ message: "Missing webhook secret or signature" });
    }

    // Verify webhook HMAC signature
    const rawPayload = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    console.log(`[Billing Webhook] Received valid event: ${event}`);

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = req.body.payload?.payment?.entity || {};
      const orderId = paymentEntity.order_id || req.body.payload?.order?.entity?.id;
      const paymentId = paymentEntity.id;

      if (!orderId) {
        return res.status(400).json({ message: "Missing order ID in webhook payload" });
      }

      // Idempotent atomic update
      const payment = await Payment.findOneAndUpdate(
        { orderId: orderId, status: "PENDING" },
        { $set: { status: "SUCCESS", transactionId: paymentId } },
        { new: true }
      );

      if (payment) {
        const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
        await axios.post(`${authServiceUrl}/update-payment`, {
          userId: payment.userId,
          plan: payment.plan,
          credits: payment.credits,
        });
        console.log(`[Billing Webhook] Processed order ${orderId} and credited user ${payment.userId}`);
      } else {
        console.log(`[Billing Webhook] Order ${orderId} already processed or not found. Deduplicated.`);
      }
    }

    // Return 200 OK immediately for webhook acknowledgement
    if (process.env.BENCH_MODE === "1") {
      console.log(`[BENCH_TRACE] [billingVerify] Order: ${razorpay_order_id} | Status: 200_SUCCESS_CREDITED`);
    }
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("[Billing Webhook] Processing error:", error);
    return res.status(500).json({ message: "Webhook handler failed", error: error.message });
  }
};
