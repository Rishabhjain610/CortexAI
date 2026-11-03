import express from "express";
import { createOrder, verifyPayment, handleWebhook } from "../controller/billing.controller.js";

const router = express.Router();

// Route to create a new Razorpay order
router.post("/create-order", createOrder);

// Route to verify Razorpay payment signatures
router.post("/verify-payment", verifyPayment);

// Route for Razorpay asynchronous webhooks
router.post("/webhook", handleWebhook);

export default router;
