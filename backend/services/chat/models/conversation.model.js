import mongoose from "mongoose";

// chat/conversation session database model definitions
const conversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "New Chat",
    },
    userId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);
export const conversationModel = new mongoose.model(
  "Conversation",
  conversationSchema,
);
