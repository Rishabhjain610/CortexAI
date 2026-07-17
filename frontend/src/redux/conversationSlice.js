import { createSlice } from "@reduxjs/toolkit";

// Redux Slice jo app ke conversations lists, active chat, aur generated artifacts ke states manage karti hai.
const conversationSlice = createSlice({
  name: "conversation",
  initialState: {
    conversations: [],
    selectedConversationId: null,
    selectedArtifact: null,
    isArtifactOpen: false,
  },
  reducers: {
    // Pure conversations list ko state me set karne ke liye.
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },
    // Naya chat create hone par use list ke sabse upar add karne aur select karne ke liye.
    addConversation: (state, action) => {
      state.conversations.unshift(action.payload);
      state.selectedConversationId = action.payload._id || action.payload.id;
    },
    // Kisi chat ko list me se remove karne aur selection state ko reset/change karne ke liye.
    removeConversation: (state, action) => {
      state.conversations = state.conversations.filter(
        (c) => (c._id || c.id) !== action.payload
      );
      if (state.selectedConversationId === action.payload) {
        state.selectedConversationId = null;
      }
    },
    // Selected conversation ID change karne wala trigger.
    setSelectedConversationId: (state, action) => {
      state.selectedConversationId = action.payload;
    },
    // Active rendering artifact define karne wala trigger.
    setSelectedArtifact: (state, action) => {
      state.selectedArtifact = action.payload;
    },
    // Right panel show/hide toggle state handler.
    setArtifactOpen: (state, action) => {
      state.isArtifactOpen = action.payload;
    },
    // Monaco editor me user dwara code update hone par Redux state files update karne wala handler.
    updateArtifactFileContent: (state, action) => {
      const { fileIdx, content } = action.payload;
      if (state.selectedArtifact?.files?.[fileIdx]) {
        state.selectedArtifact.files[fileIdx].content = content;
      }
    },
  },
});

export const {
  setConversations,
  addConversation,
  removeConversation,
  setSelectedConversationId,
  setSelectedArtifact,
  setArtifactOpen,
  updateArtifactFileContent,
} = conversationSlice.actions;
export default conversationSlice.reducer;
