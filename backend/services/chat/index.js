import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/DB.js";
import chatRouter from "./routes/chat.routes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use("/", chatRouter);

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
