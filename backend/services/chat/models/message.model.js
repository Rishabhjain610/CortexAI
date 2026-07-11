import mongoose from "mongoose";
const messageSchema = new mongoose.Schema(
  {
    content: String,
    role: {
      type: String,
      enum: ["user", "assistant"],
    },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  },
  { timestamps: true },
);
export const messageModel = new mongoose.model("Message", messageSchema);
