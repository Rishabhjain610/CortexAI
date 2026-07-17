import { getAuth } from "firebase-admin/auth";
import { app } from "../config/firebase.js";
import { User } from "../models/user.model.js";
import redis from "../../../shared/redis/redis.js";

export const login = async (req, res) => {
  try {
    const idToken = req.body.token || req.cookies.token;
    if (!idToken) {
      return res.status(400).json({ message: "Token is required" });
    }

    // firebase verify check handles
    const authClient = getAuth(app);
    const decodedToken = await authClient.verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // user database me search checks and create user logic
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        name: name || email.split("@")[0],
        email: email,
        avatar: picture,
      });
    }

    // Redis cache me session save logic
    const sessionID = crypto.randomUUID();
    await redis.set(`session:${sessionID}`, JSON.stringify(user), "EX", 5*24 * 60 * 60);

    // cookie response header options settings
    res.cookie("sessionID", sessionID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 24 * 60 * 60 * 1000, // 5 days
    });

    return res.status(200).json({
      message: "Login successful",
      user,
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({
      message: "Authentication failed",
      error: error.message,
    });
  }
};

export const logout = async (req, res) => {
  try {
    const sessionID = req.cookies.sessionID;
    if (!sessionID) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    // Redis cache database se session remove logic
    await redis.del(`session:${sessionID}`);

    // cookie clear logic
    res.clearCookie("sessionID", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return res
      .status(500)
      .json({ message: "Logout failed", error: error.message });
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({ user: req.user });
};
