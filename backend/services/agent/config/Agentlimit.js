import redis from "../../../shared/redis/redis.js";

// ===================================================================================
// Sliding Window Rate Limiter — Redis Sorted Set approach
// ===================================================================================
//
// CONCEPT — Sorted Set kya hota hai?
//   Redis Sorted Set ek aisi list hai jisme har element ke saath ek numeric "score" hota hai.
//   Sab elements HAMESHA score ke ascending order (chota → bada) me sorted rehte hain.
//   Yahan Score = timestamp (ms), isliye automatically oldest → newest order milta hai.
//
// -----------------------------------------------------------------------------------
// REDIS Z-COMMANDS GLOSSARY & MEANINGS (Sorted Set Operations):
// -----------------------------------------------------------------------------------
// 1. ZADD (Sorted Set Add)
//    - Full Form: Sorted Set Add
//    - Syntax: ZADD key score member
//    - Meaning: Naya element/member numeric "score" ke saath sorted set me insert karta hai.
//    - Score = current timestamp in ms, Member = timestamp string.
//    - Example: redis.zadd("ratelimit:user1:chatAgent", 1720000060000, "1720000060000")
//
// 2. ZREMRANGEBYSCORE (Sorted Set Remove Range By Score)
//    - Full Form: Sorted Set Remove Range By Score
//    - Syntax: ZREMRANGEBYSCORE key min max
//    - Meaning: Minimum aur maximum score range ke beech ke sabhi old elements delete karta hai.
//    - Min = "-inf" (infinity purana), Max = windowStart (60 seconds pehle ka time).
//    - Example: redis.zremrangebyscore("ratelimit:user1:chatAgent", "-inf", 1720000000000)
//
// 3. ZCOUNT (Sorted Set Count)
//    - Full Form: Sorted Set Count
//    - Syntax: ZCOUNT key min max
//    - Meaning: Range min-max ke andar kitni valid entries (requests) bachi hain wo count karta hai.
//    - Min = windowStart (60s ago), Max = "+inf" (current time).
//    - Example: redis.zcount("ratelimit:user1:chatAgent", 1720000000000, "+inf")
//
// 4. EXPIRE (Key Time To Live / Auto Clean)
//    - Syntax: EXPIRE key seconds
//    - Meaning: Key ki TTL set karta hai (60 seconds). Idle user data auto cleanup karta hai (Memory leak prevention).
//
// 5. ZRANGE (Sorted Set Range By Index)
//    - Full Form: Sorted Set Range
//    - Syntax: ZRANGE key start stop WITHSCORES
//    - Meaning: Position/index ke base pe element fetch karta hai. Index 0 = sabse purana request timestamp.
//    - WITHSCORES option member aur timestamp score dono return karta hai retryAfter calculation ke liye.
// ===================================================================================
//
// -----------------------------------------------------------------------------------
// Fixed Window vs Sliding Window — Kyun Sliding better hai?
// -----------------------------------------------------------------------------------
//   Fixed Window (BAD):
//     Minute 0:59 me 20 requests → allowed
//     Minute 1:00 pe window reset → 20 aur requests turant allowed
//     Total: 40 requests in 2 seconds! (burst attack possible)
//
//   Sliding Window (GOOD):
//     Kisi bhi 60 second ke interval me max 20 requests hi allowed
//     No burst, smooth aur fair throttling
// ===================================================================================

// Per-agent per-minute request limits (window = 60 seconds)
const LIMITS = {
  chatAgent:     20,  // Chat — frequent use expected, high limit
  pdfRagAgent:   20,  // PDF RAG — chunking + vector search is heavy, same as chat for now
  searchAgent:    5,  // Search — Tavily API costs real money, strict limit
  codingAgent:    5,  // Coding — large token context, heavy model
  pdfAgent:       5,  // PDF generation — compute intensive
  pptAgent:       5,  // PPT generation — compute intensive
  imageAgent:     5,  // Image generation — API quota protect
  imageAnalyzer: 10,  // Vision analysis — moderate limit
};

// Window duration: 60,000ms = 60 seconds (1 minute sliding window)
const WINDOW_MS = 60 * 1000;

// slidingWindowRateLimiter — Express middleware
// userId aur agentName ko state se read karta hai (x-user-id header + query param/body field)
export const slidingWindowRateLimiter = async (req, res, next) => {
  try {
    // userId Gateway ke proxyWithHeader utility ne x-user-id header me inject kiya hota hai
    const userId = req.headers["x-user-id"];
    if (!userId) return next(); // Auth check agent.controller me hoga, yahan skip

    // Agent type pehle se body me hoti hai agar manually select ki ho
    // Router baad me decide karta hai, toh hum conservative limit use karte hain agar agent unknown ho
    const agentName = req.body?.agent || "chatAgent";
    const max = LIMITS[agentName] ?? LIMITS.chatAgent;

    const now = Date.now(); // Current time in milliseconds
    const windowStart = now - WINDOW_MS; // 60 seconds pehle ka timestamp

    // Redis sorted set key — per user, per agent type alag rate limit track hoti hai
    const key = `ratelimit:${userId}:${agentName}`;

    // ---------------------------------------------------------------
    // Step 1: ZADD — Current request timestamp sorted set me add karo
    // ---------------------------------------------------------------
    // ZADD key score member
    // Score   = timestamp in milliseconds (numeric, sorted set isse sort karta hai)
    // Member  = score ka string version (member unique hona chahiye, isliye timestamp hi use kiya)
    //
    // Sorted Set State after ZADD (example):
    //   SCORE (ms timestamp)  |  MEMBER
    //   1720000010000         |  "1720000010000"  ← 50 seconds pehle ki request
    //   1720000040000         |  "1720000040000"  ← 20 seconds pehle ki request
    //   1720000060000         |  "1720000060000"  ← current request (abhi add hui)
    //
    // Elements HAMESHA score ke ascending order me sorted rehte hain (oldest → newest).
    await redis.zadd(key, now, `${now}`);

    // ---------------------------------------------------------------
    // Step 2: ZREMRANGEBYSCORE — Window se bahar ki purani entries delete karo
    // ---------------------------------------------------------------
    // ZREMRANGEBYSCORE key min max
    // Min = "-inf"       → negative infinity, yaani koi bhi score kitna bhi purana ho
    // Max = windowStart  → 60 seconds pehle ka timestamp
    //
    // Effect: Sirf last 60 seconds ki requests sorted set me bachti hain, baaki sab purge.
    //
    // BEFORE (windowStart = now - 60000):         AFTER:
    //   1719999990000  ← 70s old  → DELETED         1720000010000  ← 50s old  KEPT
    //   1720000000000  ← 60s old  → DELETED         1720000040000  ← 20s old  KEPT
    //   1720000010000  ← 50s old  → KEPT            1720000060000  ← now       KEPT
    //   1720000040000  ← 20s old  → KEPT
    //   1720000060000  ← now      → KEPT
    //
    // Yeh step ZADD ke baad karna zaroori hai — pehle add karo, phir purge karo.
    // (Agar pehle purge karo toh count galat hoga — current request miss ho sakti thi.)
    await redis.zremrangebyscore(key, "-inf", windowStart);

    // ---------------------------------------------------------------
    // Step 3: ZCOUNT — Current window me kitni requests hain count karo
    // ---------------------------------------------------------------
    // ZCOUNT key min max
    // Min = windowStart  → 60 seconds pehle se
    // Max = "+inf"       → current time tak (aur future bhi technically, practically sirf current tak)
    //
    // Returns: Window ke andar total request count (including current jo Step 1 me add ki)
    // Example: 3 requests last 60s me → count = 3
    const count = await redis.zcount(key, windowStart, "+inf");

    // ---------------------------------------------------------------
    // Step 4: EXPIRE — Key ka TTL (Time To Live) set karo
    // ---------------------------------------------------------------
    // EXPIRE key seconds
    // Agar user 60 seconds tak koi request nahi bheja, toh sorted set key automatically delete ho jaaye.
    // TTL = 60 seconds (WINDOW_MS = 60000ms / 1000 = 60 seconds)
    // Bina EXPIRE ke, stale keys Redis memory me forever accumulate hoti rahti hain — memory leak!
    await redis.expire(key, Math.ceil(WINDOW_MS / 1000));

    // ---------------------------------------------------------------
    // Step 5: Limit check — count > max hone par 429 return karo
    // ---------------------------------------------------------------
    // IMPORTANT: count > max (strictly greater) — kyunki Step 1 me current request pehle se add ho gayi.
    // Agar count === max hota toh exactly max requests hain, allow karo.
    // Agar count > max hota toh max se zyada ho gayi, block karo.
    if (count > max) {
      // ZRANGE key start stop WITHSCORES
      // Index 0 = sorted set ka sabse pehla (lowest score = oldest) element
      // WITHSCORES = member ke saath uska score bhi return karo: [member, score, member, score, ...]
      // Oldest entry ka timestamp batata hai ki yeh request kab expire hogi (60s baad)
      // Retry-After = window_size - (now - oldest_request_time)
      // Example: oldest = 50s pehle, retryAfter = 60 - 50 = 10 seconds
      const oldestEntry = await redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestTimestamp = oldestEntry?.[1] ? parseInt(oldestEntry[1]) : now;
      const retryAfterMs = WINDOW_MS - (now - oldestTimestamp);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      console.warn(
        `[Rate Limit] User ${userId} exceeded limit for ${agentName}: ${count}/${max} requests in last 60s`
      );

      return res.status(429).json({
        message: `⚠️ Rate limit exceeded for ${agentName}. You can make ${max} requests per minute. Please wait ${retryAfterSec}s before retrying.`,
        limit: max,
        used: count,
        retryAfterSeconds: retryAfterSec,
      });
    }

    // Step 6: Limit ke andar hai — request allow karo
    console.log(`[Rate Limit] User ${userId} | Agent: ${agentName} | ${count}/${max} requests used`);
    next();
  } catch (err) {
    // Redis error pe rate limiter fail-open karo — request block mat karo
    // Critical: Agar Redis down ho toh poora app rate limit ki wajah se band nahi hona chahiye
    console.error("[Rate Limit] Redis error in sliding window limiter, allowing request:", err.message);
    next();
  }
};