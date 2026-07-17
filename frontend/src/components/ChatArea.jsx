import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import Navbar from "./Navbar";
import MessageArea from "./MessageArea";
import ChatInput from "./ChatInput";
import getMessages from "../features/getMessages";
import saveMessage from "../features/saveMessage";
import sendMessage from "../features/sendMessage";
import createConversation from "../features/createConversation";
import getConversations from "../features/getCoverations";
import { addConversation, setConversations, setSelectedConversationId, setSelectedArtifact, setArtifactOpen } from "../redux/conversationSlice";

const ChatArea = ({
  isSidebarOpen,
  onToggleSidebar,
  isArtifactOpen,
  onToggleArtifact,
}) => {
  // Redux state se selected conversation ki ID fetch kar rahe hain.
  const selectedConversationId = useSelector(
    (state) => state.conversation.selectedConversationId
  );
  const dispatch = useDispatch();

  // Local state variables: messages list, loading status, aur naye banaye gaye conversation ki ID tracking.
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [justCreatedConvoId, setJustCreatedConvoId] = useState(null);
  const justCreatedConvoIdRef = useRef(null);

  // Jab conversation ID badalti hai, tab messaging history ko fetch ya reset karne wala useEffect.
  useEffect(() => {
    // Agar koi conversation active nahi hai, toh turant ek naya conversation backend par create kar dete hain.
    if (!selectedConversationId) {
      const initNewConvo = async () => {
        setLoading(true);
        const newConvo = await createConversation();
        setLoading(false);
        if (newConvo) {
          const newId = newConvo._id || newConvo.id;
          justCreatedConvoIdRef.current = newId;
          setJustCreatedConvoId(newId);
          setMessages([]);
          dispatch(addConversation(newConvo));
          dispatch(setSelectedConversationId(newId));
        }
      };
      initNewConvo();
      return;
    }

    // Agar abhi-abhi naya conversation banaya gaya hai, toh database se dobara fetch karne ki zaroorat nahi hai.
    if (selectedConversationId === justCreatedConvoIdRef.current) {
      justCreatedConvoIdRef.current = null;
      setJustCreatedConvoId(null);
      return;
    }

    // Database se chat messages ko load karne ka helper function.
    const fetchMessages = async () => {
      setLoading(true);
      const data = await getMessages(selectedConversationId);
      setMessages(data);
      setLoading(false);
    };
    fetchMessages();
  }, [selectedConversationId, justCreatedConvoId, dispatch]);

  // User ke dwara naya message send hone par call hone wala function.
  const handleSendMessage = async (text, options = {}) => {
    if (!text.trim()) return;

    const isFirstMessage = messages.length === 0;
    let convoId = selectedConversationId;
    let isNewConvo = false;

    // Backup safety check: agar convoId missing hai toh naya create kar do.
    if (!convoId) {
      isNewConvo = true;
      setLoading(true);
      const newConvo = await createConversation();
      setLoading(false);
      if (!newConvo) {
        console.error("Failed to create new conversation");
        return;
      }
      const newId = newConvo._id || newConvo.id;
      justCreatedConvoIdRef.current = newId;
      setJustCreatedConvoId(newId);
      dispatch(addConversation(newConvo));
      dispatch(setSelectedConversationId(newId));
      convoId = newId;
    }

    // 1. User ka message turant UI me optimistically show karne ke liye add kar rahe hain.
    const tempUserMsg = {
      role: "user",
      content: text,
      _id: `user-${Date.now()}`,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // 2. AI response stream karne ke liye ek empty initial AI message UI me add kar rahe hain.
    const tempAiMsgId = `ai-${Date.now()}`;
    const tempAiMsg = {
      role: "assistant",
      content: "",
      _id: tempAiMsgId,
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    let accumulatedText = "";
    let accumulatedImages = [];
    let accumulatedArtifacts = [];

    // 3. Backend (LangGraph agent) se live output stream receive karne ke liye sendMessage invoke kar rahe hain.
    await sendMessage(convoId, text, options, (chunk) => {
      if (chunk.text) {
        accumulatedText += chunk.text;
      }
      if (chunk.images) {
        accumulatedImages = [...new Set([...accumulatedImages, ...chunk.images])];
      }
      if (chunk.artifacts) {
        accumulatedArtifacts = [...accumulatedArtifacts, ...chunk.artifacts];
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempAiMsgId 
            ? { ...msg, content: accumulatedText, images: accumulatedImages, artifacts: accumulatedArtifacts } 
            : msg
        )
      );
    });

    if (accumulatedText) {
      // 4. Poora response stream ho jaane ke baad pure message ko database me save karenge.
      await saveMessage(convoId, accumulatedText, "assistant", accumulatedImages, accumulatedArtifacts);
    }

    // Agar model ne naya artifact generate kiya hai, toh usko right-side panel me automatically select aur open kar do.
    if (accumulatedArtifacts.length > 0) {
      dispatch(setSelectedArtifact(accumulatedArtifacts[0]));
      dispatch(setArtifactOpen(true));
    }

    // 5. User/Assistant message IDs ko sync karne ke liye, fresh messages list db se reload karte hain.
    const updatedMessages = await getMessages(convoId);
    if (updatedMessages) {
      setMessages(updatedMessages);
    }

    // Agar ye new conversation ka pehla message tha, toh sidebar update karenge taaki sahi chat title dikhe.
    if (isNewConvo || isFirstMessage) {
      const convos = await getConversations();
      if (convos) {
        dispatch(setConversations(convos));
      }
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-base-900">
      {/* Top Navbar */}
      <Navbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        isArtifactOpen={isArtifactOpen}
        onToggleArtifact={onToggleArtifact}
      />

      {/* Message scrolling area */}
      <MessageArea
        messages={messages}
        loading={loading}
        selectedConversationId={selectedConversationId || justCreatedConvoId}
      />

      {/* Bottom text composer area */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={false}
      />
    </div>
  );
};

export default ChatArea;