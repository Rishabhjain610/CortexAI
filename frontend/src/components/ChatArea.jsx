import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import Navbar from "./Navbar";
import MessageArea from "./MessageArea";
import ChatInput from "./ChatInput";
import getMessages from "../features/getMessages";
import saveMessage from "../features/saveMessage";
import sendMessage from "../features/sendMessage";
import createConversation from "../features/createConversation";
import getConversations from "../features/getCoverations";
import { addConversation, setConversations } from "../redux/conversationSlice";

const ChatArea = ({
  isSidebarOpen,
  onToggleSidebar,
  isArtifactOpen,
  onToggleArtifact,
}) => {
  const selectedConversationId = useSelector(
    (state) => state.conversation.selectedConversationId
  );
  const dispatch = useDispatch();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [justCreatedConvoId, setJustCreatedConvoId] = useState(null);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    // If this is a conversation we just created, do not reload/fetch from DB
    if (selectedConversationId === justCreatedConvoId) {
      setJustCreatedConvoId(null);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      const data = await getMessages(selectedConversationId);
      setMessages(data);
      setLoading(false);
    };
    fetchMessages();
  }, [selectedConversationId, justCreatedConvoId]);

  const handleSendMessage = async (text, options = {}) => {
    if (!text.trim()) return;

    let convoId = selectedConversationId;
    let isNewConvo = false;

    // If no conversation is active, create a new one first
    if (!convoId) {
      isNewConvo = true;
      setLoading(true);
      const newConvo = await createConversation();
      setLoading(false);
      if (!newConvo) {
        console.error("Failed to create new conversation");
        return;
      }
      setJustCreatedConvoId(newConvo._id || newConvo.id);
      dispatch(addConversation(newConvo));
      convoId = newConvo._id || newConvo.id;
    }

    // 1. Optimistically add user message to UI
    const tempUserMsg = {
      role: "user",
      content: text,
      _id: `user-${Date.now()}`,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // 2. Add an empty assistant message to UI for streaming
    const tempAiMsgId = `ai-${Date.now()}`;
    const tempAiMsg = {
      role: "assistant",
      content: "",
      _id: tempAiMsgId,
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    let accumulatedText = "";

    // 3. Trigger stream from the backend LangGraph agent
    await sendMessage(convoId, text, options, (chunkText) => {
      accumulatedText += chunkText;
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempAiMsgId ? { ...msg, content: accumulatedText } : msg
        )
      );
    });

    if (accumulatedText) {
      // 4. Save the completed assistant message to database
      await saveMessage(convoId, accumulatedText, "assistant");
    }

    // 5. Fetch the updated messages list to sync user/assistant message IDs
    const updatedMessages = await getMessages(convoId);
    if (updatedMessages) {
      setMessages(updatedMessages);
    }

    // If it was a new conversation, refresh the sidebar list to show the generated title
    if (isNewConvo) {
      // Give the backend a slight moment to finish the async title generation
      setTimeout(async () => {
        const convos = await getConversations();
        if (convos) {
          dispatch(setConversations(convos));
        }
      }, 1200);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-base-900">
      <Navbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        isArtifactOpen={isArtifactOpen}
        onToggleArtifact={onToggleArtifact}
      />

      <MessageArea
        messages={messages}
        loading={loading}
        selectedConversationId={selectedConversationId || justCreatedConvoId}
      />

      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={false}
      />
    </div>
  );
};

export default ChatArea;