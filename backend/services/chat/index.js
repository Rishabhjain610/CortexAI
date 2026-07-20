import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/DB.js";
import chatRouter from "./routes/chat.routes.js";

dotenv.config();

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// router mapping integration
app.use("/", chatRouter);

// database link verify and chat service port start logic
const startServer = async () => {
  try {
    await connectDB();
    app.listen(process.env.PORT, () => {
      console.log(`Chat server is running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.log(error);
  }
};

startServer();
