import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./redux/store.js";
import "./index.css";

// React Root element trigger aur Redux/Routing setup initialization wrapper.
createRoot(document.getElementById("root")).render(
  
    <BrowserRouter>
      {/* React core state store ko components me access karne ke liye Provider wrap kiya */}
      <Provider store={store}>
        <App />
      </Provider>
    </BrowserRouter>
  
);
