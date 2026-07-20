import express from "express";
import { agent } from "../controller/agent.controller.js";
import { handleUpload } from "../middleware/multer.middleware.js";

const router = express.Router();

// dynamic server health status endpoint
router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Agent service is healthy",
  });
});

// agent interaction endpoint
router.post("/chat", handleUpload.single("file"), agent);

export default router;
