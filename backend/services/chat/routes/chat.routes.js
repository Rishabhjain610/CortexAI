import express from "express";
import {
  createConversation,
  getConversations,
  saveMessage,
  updateConversation,
  deleteConversation,
  getMessage,
} from "../controller/chat.controller.js";

const router = express.Router();

// Chat service ke REST endpoints mapping rules.
router.post("/create-conversation", createConversation);
router.get("/get-conversations", getConversations);
router.put("/update-conversation", updateConversation);
router.post("/save-message", saveMessage);
router.delete("/delete-conversation/:conversationId", deleteConversation);
router.get("/get-messages/:conversationId", getMessage);

export default router;
