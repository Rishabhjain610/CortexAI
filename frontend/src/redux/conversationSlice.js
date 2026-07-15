import { createSlice } from "@reduxjs/toolkit";

const conversationSlice = createSlice({
  name: "conversation",
  initialState: {
    conversations: [],
    selectedConversationId: null,
  },
  reducers: {
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },
    addConversation: (state, action) => {
      state.conversations.unshift(action.payload);
      // Auto-select the newly created conversation
      state.selectedConversationId = action.payload._id || action.payload.id;
    },
    removeConversation: (state, action) => {
      state.conversations = state.conversations.filter(
        (c) => (c._id || c.id) !== action.payload
      );
      // If the deleted conversation was selected, reset selection
      if (state.selectedConversationId === action.payload) {
        state.selectedConversationId = null;
      }
    },
    setSelectedConversationId: (state, action) => {
      state.selectedConversationId = action.payload;
    },
  },
});

export const {
  setConversations,
  addConversation,
  removeConversation,
  setSelectedConversationId,
} = conversationSlice.actions;
export default conversationSlice.reducer;
