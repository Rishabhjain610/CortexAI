import dotenv from "dotenv";
dotenv.config();
import express from 'express'
import cookieParser from 'cookie-parser'
import connectDB from './config/db.js';
import authRouter from './routes/auth.routes.js';
const app=express();
app.use(cookieParser());
app.use(express.json());

app.get("/", (req, res) => {
    console.log("Auth Service")
    return res.json({ message: "hello from auth service" });
});

app.use("/", authRouter);
const StartServer=async()=>{
    try {
        await connectDB();
        app.listen(process.env.PORT,()=>{
            console.log(`Auth server is running on port ${process.env.PORT}`);
        });
    } catch (error) {
        console.log(error);
    }
}
StartServer();