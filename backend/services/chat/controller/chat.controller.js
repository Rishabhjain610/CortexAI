import { conversationModel } from "../models/conversation.model.js";
import { messageModel } from "../models/message.model.js";

export const createConversation = async (req, res) => {
  try {
    const conversation = await conversationModel.create({
      userId: req.headers["x-user-id"],
      title: "New Chat",
    });
    return res.status(201).json({
      success: true,
      message: "Conversation created",
      data: conversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating conversation",
      error: error.message,
    });
  }
};

export const getConversations = async (req, res) => {
  try {
    const conversations = await conversationModel
      .find({
        userId: req.headers["x-user-id"],
      })
      .sort({ updatedAt: -1 });
    return res.status(200).json({
      success: true,
      message: "Conversations fetched",
      data: conversations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching conversations",
      error: error.message,
    });
  }
};

export const saveMessage = async (req, res) => {
  try {
    const { conversationId, content, role } = req.body;
    const savedMessage = await messageModel.create({
      conversation: conversationId,
      content,
      role: role || "user",
    });
    return res.status(201).json({
      success: true,
      message: "Message saved",
      data: savedMessage,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error saving message",
      error: error.message,
    });
  }
};
export const updateConversation = async (req, res) => {
  try {
    const { conversationId, title } = req.body;
    const updatedConversation = await conversationModel.findByIdAndUpdate(
      conversationId,
      { title },
      { new: true },
    );
    return res.status(200).json({
      success: true,
      message: "Conversation updated",
      data: updatedConversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating conversation",
      error: error.message,
    });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const deletedConversation = await conversationModel.findByIdAndDelete(
      conversationId,
    );
    return res.status(200).json({
      success: true,
      message: "Conversation deleted",
      data: deletedConversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting conversation",
      error: error.message,
    });
  }
};
export const getMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await messageModel.find({ conversation: conversationId });
    return res.status(200).json({
      success: true,
      message: "Messages fetched",
      data: messages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching messages",
      error: error.message,
    });
  }
};