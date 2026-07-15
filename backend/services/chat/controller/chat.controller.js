import { conversationModel } from "../models/conversation.model.js";
import { messageModel } from "../models/message.model.js";
import redis from "../../../shared/redis/redis.js";

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

    // Active conversation ka cache agar Redis mein pehle se bana hua hai,
    // toh usme naya message append kar denge, latest 20 messages ko keep karenge aur 30 minutes ka TTL refresh karenge.
    const cacheKey = `chat:history:${conversationId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      let messages = JSON.parse(cached);
      messages.push(savedMessage);
      
      // Sirf latest 20 messages hi save karenge Redis mein
      if (messages.length > 20) {
        messages = messages.slice(-20);
      }
      
      await redis.set(cacheKey, JSON.stringify(messages), "EX", 30 * 60); // 30 minutes ke liye cache refresh kiya
    }

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
    const cacheKey = `chat:history:${conversationId}`;

    // 1. Sabse pehle cache check karenge Redis mein
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[Cache Hit] Serving history for convo ${conversationId} from Redis`);
      return res.status(200).json({
        success: true,
        message: "Messages fetched (Cached)",
        data: JSON.parse(cached),
      });
    }

    // 2. Cache Miss: Agar Redis mein nahi mila, toh MongoDB se fetch karenge
    console.log(`[Cache Miss] Fetching history for convo ${conversationId} from MongoDB`);
    let messages = await messageModel.find({ conversation: conversationId });

    // Sirf latest 20 messages hi cache aur return karenge
    if (messages.length > 20) {
      messages = messages.slice(-20);
    }

    // 3. Agli baar ke liye data ko Redis cache mein save karenge 30 minutes ke TTL ke sath
    await redis.set(cacheKey, JSON.stringify(messages), "EX", 30 * 60);

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