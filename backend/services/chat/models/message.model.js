import mongoose from "mongoose";

// workspace sub-files schema representation
const fileSchema = new mongoose.Schema(
  {
    name: String,
    content: String,
  },
  { _id: false },
);

// artifact output (code assets bundle) schema mapping definitions
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

// chat individual text / images / artifacts message model definitions
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
