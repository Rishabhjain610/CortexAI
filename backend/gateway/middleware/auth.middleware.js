import redis from "../../shared/redis/redis.js";

export const requireAuth = async (req, res, next) => {
  try {
    const sessionID = req.cookies.sessionID;
    if (!sessionID) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No session found" });
    }

    const cachedUser = await redis.get(`session:${sessionID}`);
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
