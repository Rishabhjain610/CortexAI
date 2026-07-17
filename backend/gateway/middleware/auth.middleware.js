import redis from "../../shared/redis/redis.js";

// Session-based authentication verify karne wala middleware.
export const requireAuth = async (req, res, next) => {
  try {
    // CORS preflight OPTIONS request ke liye check, isme browser cookies nahi bhejta.
    // So isko bina auth check ke next() middleware par pass kar do.
    if (req.method === "OPTIONS") {
      return next();
    }
   
    const sessionID = req.cookies.sessionID;
    if (!sessionID) {
      console.log("Auth failed: No sessionID cookie found");
      return res
        .status(401)
        .json({ message: "Unauthorized: No session found" });
    }

    // Redis cache database se session check karke session user data details retrieve kar rahe hain.
    const cachedUser = await redis.get(`session:${sessionID}`);
    console.log("Session lookup in Redis:", cachedUser ? "FOUND" : "NOT FOUND");
    if (!cachedUser) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Session expired or invalid" });
    }

    req.user = JSON.parse(cachedUser);
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
