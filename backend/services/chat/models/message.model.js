import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    name: String,
    content: String,
  },
  { _id: false },
);

const artifactSchema = new mongoose.Schema(
  {
    id: Number,
    type: String,
    title:String,
    files: [{ type: fileSchema }],
  },
  {
    _id: false,
  },
);
const messageSchema = new mongoose.Schema(
  {
    content: String,
    role: {
      type: String,
      enum: ["user", "assistant"],
    },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
    images: {
      type: [String],
      default: [],
    },
    artifacts: {
      type:[artifactSchema],
      default: [],
    },
  },
  { timestamps: true },
);
export const messageModel = new mongoose.model("Message", messageSchema);
