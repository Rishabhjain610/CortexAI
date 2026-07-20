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

// Services routing proxy rules definition.
// KYA AUR KYUN: 
// 1. parseReqBody: false - Gateway me express.json() ya body parsing ko OFF rakha gaya hai taaki HTTP request body buffer (large JSON / file uploads) pre-consume na ho.
// 2. Stream Preservation - Express proxy un-consumed raw stream ko direct downstream microservices ko pipe karta hai.
// 3. /api/auth me parseReqBody: false explicitly set kiya gaya hai kyunki yeh raw proxy() call use karta hai (non-authenticated public routes jaise /login).
// 4. /api/chat, /api/agent, aur /api/billing me proxyWithHeader utility use hoti hai, jisme parseReqBody: false aur 50mb limit already built-in defined hai.
app.use("/api/auth", proxy(process.env.AUTH_SERVICE_URL, { parseReqBody: false }));
app.use("/api/chat", requireAuth, proxyWithHeader(process.env.CHAT_SERVICE_URL));
app.use("/api/agent", requireAuth, proxyWithHeader(process.env.AGENT_SERVICE_URL));
app.use("/api/billing", requireAuth, proxyWithHeader(process.env.BILLING_SERVICE_URL));
app.use("/api/me", requireAuth, getMe);

// Main Gateway port listening wrapper.
app.listen(process.env.PORT, () => {
  console.log(`Gateway server is running on port ${process.env.PORT}`);
});
