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
export const updateUserPayment = async (req, res) => {
  try {
    const { plan, credits, userId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.plan = plan;
    user.credits = user.credits + credits;
    user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    // Active user ke session details sync karne ke liye Redis cache update check kiya
    try {
      // Redis se 'session:*' pattern wali saari active session keys nikal rahe hain
      const keys = await redis.keys("session:*");
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const cachedUser = JSON.parse(data);
          const cachedId = cachedUser._id || cachedUser.id;
          
          // Agar database userId user ke active session data se match ho jata hai, to plan info refresh karenge
          if (cachedId === userId) {
            cachedUser.plan = plan;
            cachedUser.credits = user.credits;
            cachedUser.planExpiresAt = user.planExpiresAt;
            
            // TTL (Time To Live) checking yahan critical hai:
            // Redis me jab bhi naya value set karte hain, to by default purana expiry time hat jata hai aur key permanent ban jati hai.
            // Hum user session ko infinite time active nahi rakhna chahte. Isliye pehle current remaining TTL (in seconds) fetch karenge.
            const ttl = await redis.ttl(key);
            
            if (ttl > 0) {
              // Agar existing expiry set thi (seconds > 0), to updated user data ko usi exact remaining time "EX" ke sath overwrite kiya
              await redis.set(key, JSON.stringify(cachedUser), "EX", ttl);
            } else {
              // Agar key pehle se permanent thi (yaani dynamic TTL -1 tha), to direct update save kiya
              await redis.set(key, JSON.stringify(cachedUser));
            }
            console.log(`Updated Redis session for user ${userId} in key ${key}`);
          }
        }
      }
    } catch (redisErr) {
      console.error("Failed to update Redis session:", redisErr);
    }

    return res.status(200).json({ message: "User payment updated successfully", user });
  } catch (error) {
    console.error("User payment update failed:", error);
    return res.status(500).json({ message: "User payment update failed", error: error.message });
  }
};

export const deductUserCredit = async (req, res) => {
  try {
    const { userId, amount = 1 } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if user has enough credits for the specific agent's cost
    if (user.credits < amount) {
      return res.status(403).json({ 
        message: `Insufficient credits. This request requires ${amount} credits, but you only have ${user.credits} remaining. Please upgrade your subscription.`,
        requiredCredits: amount,
        availableCredits: user.credits
      });
    }
    
    user.credits -= amount;
    await user.save();

    // Active user ke session details sync karne ke liye Redis cache update check kiya
    try {
      const keys = await redis.keys("session:*");
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const cachedUser = JSON.parse(data);
          const cachedId = cachedUser._id || cachedUser.id;
          if (cachedId === userId) {
            cachedUser.credits = user.credits;
            const ttl = await redis.ttl(key);
            if (ttl > 0) {
              await redis.set(key, JSON.stringify(cachedUser), "EX", ttl);
            } else {
              await redis.set(key, JSON.stringify(cachedUser));
            }
            console.log(`Updated Redis session credits for user ${userId} in key ${key}`);
          }
        }
      }
    } catch (redisErr) {
      console.error("Failed to update Redis session in deductUserCredit:", redisErr);
    }

    return res.status(200).json({ message: "Credit deducted successfully", credits: user.credits });
  } catch (error) {
    console.error("Deduct credit failed:", error);
    return res.status(500).json({ message: "Deduct credit failed", error: error.message });
  }
};