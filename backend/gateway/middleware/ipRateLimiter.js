import crypto from "crypto";
import redis from "../../shared/redis/redis.js";

// ===================================================================================
// Gateway IP-Based Sliding Window Rate Limiter — Redis Sorted Set (ZSET)
// ===================================================================================
//
// PURPOSE:
//   API Gateway level rate limiter. Har client IP address ki requests track karta hai
//   taaki automated scrapers, DDoS attacks, aur brute-force bot attacks se downstream
//   microservices (auth, chat, agent, billing) protected rahein.
//
// REDIS Z-COMMANDS USED:
//   1. ZADD: Adds current request timestamp (ms) into sorted set `ratelimit:ip:${clientIp}`
//   2. ZREMRANGEBYSCORE: Purges request timestamps older than 60 seconds
//   3. ZCOUNT: Counts remaining valid requests within last 60 seconds
//   4. EXPIRE: Sets 60-second TTL on Redis key to prevent memory leaks for idle IPs
//   5. ZRANGE: Fetches oldest request timestamp to calculate precise `retryAfterSeconds`
// ===================================================================================

const WINDOW_MS = 60 * 1000; // 60 seconds (1 minute sliding window)
const DEFAULT_LIMIT = parseInt(process.env.GATEWAY_IP_RATE_LIMIT || "100", 10); // 100 requests per minute per IP

export const ipRateLimiter = async (req, res, next) => {
  try {
    // CORS preflight OPTIONS requests ko bypass karo (browser cookies/headers send nahi karta)
    if (req.method === "OPTIONS") {
      return next();
    }

    // Client IP address extract karo (reverse proxy / load balancer support via x-forwarded-for)
    const forwardedFor = req.headers["x-forwarded-for"];
    const clientIp = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : req.ip || req.socket?.remoteAddress || "unknown_ip";

    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Redis sorted set key per IP address
    const key = `ratelimit:ip:${clientIp}`;

    // Step 1: Current request timestamp sorted set me insert karo
    // Har member ko unique UUID de rahe hain taaki same millisecond me parallel requests overwrite na hon
    const member = `${now}:${crypto.randomUUID()}`;
    await redis.zadd(key, now, member);

    // Step 2: 60 seconds se purani request entries delete karo
    await redis.zremrangebyscore(key, "-inf", windowStart);

    // Step 3: Current sliding window me kitni requests bachi hain count karo
    const count = await redis.zcount(key, windowStart, "+inf");

    // Step 4: Key pe 60 seconds ka TTL set karo (memory leak protection)
    await redis.expire(key, Math.ceil(WINDOW_MS / 1000));

    // Step 5: Limit check — count > limit hone par 429 Too Many Requests response bhejo
        if (process.env.BENCH_MODE === "1") {
      console.log(`[BENCH_TRACE] [ipRateLimiter] IP: ${clientIp} | Count: ${count} / ${DEFAULT_LIMIT} | Allowed: ${count <= DEFAULT_LIMIT}`);
    }
    if (count > DEFAULT_LIMIT) {
      const oldestEntry = await redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestTimestamp = oldestEntry?.[1] ? parseInt(oldestEntry[1], 10) : now;
      const retryAfterMs = WINDOW_MS - (now - oldestTimestamp);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      console.warn(
        `[Gateway IP Limit] IP ${clientIp} exceeded limit: ${count}/${DEFAULT_LIMIT} requests in last 60s`
      );

      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        message: `⚠️ Global Gateway IP Rate Limit Exceeded. You can make maximum ${DEFAULT_LIMIT} requests per minute. Please wait ${retryAfterSec} seconds before retrying.`,
        ip: clientIp,
        limit: DEFAULT_LIMIT,
        used: count,
        retryAfterSeconds: retryAfterSec,
      });
    }

    // Request limit ke andar hai — next middleware / route proxy to execute
    next();
  } catch (err) {
    // Fail-open resilience: Redis connection error / timeout hone par request allow karo
    // taaki Redis failure ki wajah se poora API Gateway block na ho
    console.error("[Gateway IP Limit] Redis error in IP rate limiter, allowing request:", err.message);
    next();
  }
};
