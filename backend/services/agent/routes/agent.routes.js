import express from "express";
import {
  agent,
  enqueuePdfRag,
  enqueuePptGen,
  enqueuePdfGen,
  getJobStatus,
} from "../controller/agent.controller.js";
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

// Synchronous SSE agent interaction endpoint
router.post("/chat", handleUpload.single("file"), slidingWindowRateLimiter, agent);

// BullMQ Asynchronous Background Routes
router.post("/async/rag", handleUpload.single("file"), slidingWindowRateLimiter, enqueuePdfRag);
router.post("/async/ppt", slidingWindowRateLimiter, enqueuePptGen);
router.post("/async/pdf", slidingWindowRateLimiter, enqueuePdfGen);
router.get("/job/:jobId", getJobStatus);

export default router;


