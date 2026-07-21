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
  onOpenUpgrade,
}) => {
  // Redux se active chat/convo ID nikalne ke liye
  const selectedConversationId = useSelector(
    (state) => state.conversation.selectedConversationId
  );
  const dispatch = useDispatch();

  // normal states (messages list, loading state, aur naye convo ki tracking)
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [justCreatedConvoId, setJustCreatedConvoId] = useState(null);
  const justCreatedConvoIdRef = useRef(null);

  // conversation change hone par messaging history load karne ka hook
  useEffect(() => {
    // agar koi conversation active nahi hai toh naya bana do
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

    // abhi naya convo bana hai toh db se reload karne ki need nahi hai
    if (selectedConversationId === justCreatedConvoIdRef.current) {
      justCreatedConvoIdRef.current = null;
      setJustCreatedConvoId(null);
      return;
    }

    // db se chat messages load karne ka function
    const fetchMessages = async () => {
      setLoading(true);
      const data = await getMessages(selectedConversationId);
      setMessages(data);
      setLoading(false);
    };
    fetchMessages();
  }, [selectedConversationId, justCreatedConvoId, dispatch]);

  // message send karne par trigger hone wala main handler
  const handleSendMessage = async (textOrFormData, options = {}) => {
    // ChatInput FormData ya plain string — dono handle karte hain
    let text, file;
    if (textOrFormData instanceof FormData) {
      text = textOrFormData.get("message") || "";
      file = textOrFormData.get("file") || null;
      const agent = textOrFormData.get("agent");
      const model = textOrFormData.get("model");
      if (agent) options = { ...options, agent };
      if (model) options = { ...options, model };
    } else {
      text = textOrFormData || "";
    }

    if (!text.trim() && !file) return;

    const isFirstMessage = messages.length === 0;
    let convoId = selectedConversationId;
    let isNewConvo = false;

    // check lagaya hai taaki agar convo ID na ho toh pehle convo create ho
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

    const fileLabel = file ? (file.type?.startsWith("image/") ? `🖼️ ${file.name}` : `📄 ${file.name}`) : "";
    const userContentText = text ? (fileLabel ? `${text}\n\n[Attached: ${fileLabel}]` : text) : fileLabel;

    // 1. user ka text turant UI me show karne ke liye dummy message array me push
    const tempUserMsg = {
      role: "user",
      content: userContentText,
      imagePreview: file && file.type?.startsWith("image/") ? URL.createObjectURL(file) : null,
      _id: `user-${Date.now()}`,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // 2. AI stream load hone se pehle blank structure insert
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
    let accumulatedPdf = "";

    // File present hone par options me daal do taaki sendMessage FormData mode use kare
    if (file) options = { ...options, file };

    // 3. agent service se real-time chunks pull karna
    try {
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
        if (chunk.pdf) {
          accumulatedPdf = chunk.pdf;
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempAiMsgId 
              ? { ...msg, content: accumulatedText, images: accumulatedImages, artifacts: accumulatedArtifacts, pdf: accumulatedPdf } 
              : msg
          )
        );
      });
    } catch (err) {
      console.error("Error sending message:", err);
      const is403 = err.message && err.message.includes("403");
      const is401 = err.message && err.message.includes("401");
      
      let errorMsg = "⚠️ Failed to get response from AI assistant. Please try again.";
      
      if (is401) {
        errorMsg = "⚠️ Your session has expired. Please log in again to continue.";
      } else if (is403) {
        errorMsg = "⚠️ Insufficient credits. Please upgrade your subscription to continue.";
      } else if (err.message) {
        try {
          const jsonStart = err.message.indexOf("{");
          if (jsonStart !== -1) {
            const jsonStr = err.message.slice(jsonStart);
            const errObj = JSON.parse(jsonStr);
            if (errObj.message) {
              errorMsg = errObj.message;
            }
          }
        } catch (parseErr) {
          // JSON parsing failure fallback
        }
      }
        
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempAiMsgId 
            ? { ...msg, content: errorMsg } 
            : msg
        )
      );
      
      if (is403 && onOpenUpgrade) {
        onOpenUpgrade();
      }
      return;
    }

    if (accumulatedText || accumulatedPdf) {
      // 4. complete message generate hone par use database me save karenge
      await saveMessage(convoId, accumulatedText, "assistant", accumulatedImages, accumulatedArtifacts, accumulatedPdf);
    }

    // code/artifact banne par right drawer auto open
    if (accumulatedArtifacts.length > 0) {
      dispatch(setSelectedArtifact(accumulatedArtifacts[0]));
      dispatch(setArtifactOpen(true));
    }

    // 5. final IDs fetch aur state update
    const updatedMessages = await getMessages(convoId);
    if (updatedMessages) {
      setMessages(updatedMessages);
    }

    // first message hone par sidebar refreshes
    if (isNewConvo || isFirstMessage) {
      const convos = await getConversations();
      if (convos) {
        dispatch(setConversations(convos));
      }
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-base-900">
      {/* Top Navbar display */}
      <Navbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        isArtifactOpen={isArtifactOpen}
        onToggleArtifact={onToggleArtifact}
      />

      {/* chat window messaging list area */}
      <MessageArea
        messages={messages}
        loading={loading}
        selectedConversationId={selectedConversationId || justCreatedConvoId}
      />

      {/* input write area container */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={false}
      />
    </div>
  );
};

export default ChatArea;