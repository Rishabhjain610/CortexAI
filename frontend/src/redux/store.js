import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./userSlice";
import conversationReducer from "./conversationSlice";
const store = configureStore({
  reducer: {
    user: userReducer,
    conversation: conversationReducer,
  },
});
export default store;
