import express from "express";
import dotenv from "dotenv";
import proxy from "express-http-proxy";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getMe } from "./controller/user.controller.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import proxyWithHeader from "./utils/proxyWithHeader.js"

dotenv.config();
const app = express();

// CORS origin aur cookie transmission configuration credentials mapping.
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

// Services routing proxy rules definition.
// Auth service, Chat service, aur LangGraph agent service ke request patterns maps.
app.use("/api/auth", proxy(process.env.AUTH_SERVICE_URL));
app.use("/api/chat", requireAuth, proxyWithHeader(process.env.CHAT_SERVICE_URL));
app.use("/api/agent", requireAuth, proxyWithHeader(process.env.AGENT_SERVICE_URL));
app.use("/api/me", requireAuth, getMe);

// Main Gateway port listening wrapper.
app.listen(process.env.PORT, () => {
  console.log(`Gateway server is running on port ${process.env.PORT}`);
});
