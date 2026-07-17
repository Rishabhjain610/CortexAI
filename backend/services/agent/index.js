import "dotenv/config";
import express from "express";
import connectDB from "./config/DB.js";
import agentRouter from "./routes/agent.routes.js";

const app = express();

app.use(express.json());

// router mapping integration
app.use("/", agentRouter);

// database link verify and agent port start logic
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
