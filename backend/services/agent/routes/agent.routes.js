import express from "express";
import { agent } from "../controller/agent.controller.js";

const router = express.Router();

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Agent service is healthy",
  });
});

router.post("/chat", agent);

export default router;
