import { Redis } from "ioredis";

// BullMQ requires a dedicated Redis connection with maxRetriesPerRequest set to null
export const bullRedisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

bullRedisConnection.on("connect", () => {
  console.log("[BullMQ] Redis connection established successfully");
});

bullRedisConnection.on("error", (err) => {
  console.error("[BullMQ] Redis connection error:", err.message);
});
