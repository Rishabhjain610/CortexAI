import express from "express";
import { createOrder, verifyPayment } from "../controller/billing.controller.js";

const router = express.Router();

// Route to create a new Razorpay order
router.post("/create-order", createOrder);

// Route to verify Razorpay payment signatures
router.post("/verify-payment", verifyPayment);

export default router;
