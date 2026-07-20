import express from "express";
import { agent } from "../controller/agent.controller.js";
import { handleUpload } from "../middleware/multer.middleware.js";
import { slidingWindowRateLimiter } from "../config/Agentlimit.js";

const router = express.Router();

// Dynamic server health status endpoint — load balancer checks ke liye
router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Agent service is healthy",
  });
});

// Agent interaction endpoint
// Middleware chain: File upload parse → Sliding Window Rate Limit check → Agent controller
// Rate limiter pehle run hoga — agar limit exceed ho toh 429 return karo, warna agent controller execute ho
router.post("/chat", handleUpload.single("file"), slidingWindowRateLimiter, agent);

export default router;

