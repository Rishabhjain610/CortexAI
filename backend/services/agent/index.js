import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/DB.js";
import agentRouter from "./routes/agent.routes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use("/", agentRouter);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(process.env.PORT, () => {
      console.log(`Agent server is running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error(error);
  }
};

startServer();
