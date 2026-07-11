import express from "express";

const router = express.Router();

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Agent service is healthy",
  });
});

export default router;
