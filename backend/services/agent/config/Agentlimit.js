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
// ZADD key score member
// -----------------------------------------------------------------------------------
//   Naya element sorted set me insert karta hai.
//   Score   = current timestamp in milliseconds (sorting key)
//   Member  = score ka string (member unique hona chahiye — duplicate member ka score update ho jaata hai)
//
//   redis.zadd("ratelimit:user1:chatAgent", 1720000060000, "1720000060000")
//
//   Sorted Set State after ZADD:
//   ┌──────────────────────────────────────────┐
//   │  SCORE (ms timestamp)  │  MEMBER         │
//   ├────────────────────────┼─────────────────┤
//   │  1720000010000         │ "1720000010000" │  ← 50 seconds pehle ki request
//   │  1720000040000         │ "1720000040000" │  ← 20 seconds pehle ki request
//   │  1720000060000         │ "1720000060000" │  ← current request (abhi add hui)
//   └──────────────────────────────────────────┘
//
// -----------------------------------------------------------------------------------
// ZREMRANGEBYSCORE key min max
// -----------------------------------------------------------------------------------
//   Score range ke beech ke sab members delete karta hai.
//   Min = "-inf"        → negative infinity (koi bhi purana score)
//   Max = windowStart   → now - 60000 (60 seconds pehle ka timestamp)
//
//   redis.zremrangebyscore("ratelimit:user1:chatAgent", "-inf", 1720000000000)
//
//   BEFORE (windowStart = 1720000000000):      AFTER (sirf last 60s bachi):
//   ┌─────────────────────────────────┐        ┌──────────────────────────────────┐
//   │ 1719999990000 ← 70s old DELETED │        │ 1720000010000 ← 50s old  KEPT   │
//   │ 1720000000000 ← 60s old DELETED │        │ 1720000040000 ← 20s old  KEPT   │
//   │ 1720000010000 ← 50s old KEPT    │  ───►  │ 1720000060000 ← now      KEPT   │
//   │ 1720000040000 ← 20s old KEPT    │        └──────────────────────────────────┘
//   │ 1720000060000 ← now     KEPT    │
//   └─────────────────────────────────┘
//   NOTE: ZADD PEHLE karo, ZREMRANGEBYSCORE BAAD ME — warna current request bhi delete ho sakti hai!
//
// -----------------------------------------------------------------------------------
// ZCOUNT key min max
// -----------------------------------------------------------------------------------
//   Score range ke andar kitne members hain count karta hai (delete nahi karta).
//   Min = windowStart  → last 60 seconds se
//   Max = "+inf"       → current time tak aur aage bhi (practically sirf current tak)
//
//   redis.zcount("ratelimit:user1:chatAgent", 1720000000000, "+inf")
//   → Returns: 3  (3 requests in last 60 seconds, including current one)
//
// -----------------------------------------------------------------------------------
// EXPIRE key seconds
// -----------------------------------------------------------------------------------
//   Key ka TTL (Time To Live) set karta hai — expire hone par key auto-delete ho jaati hai.
//   TTL = 60 seconds = WINDOW_MS / 1000
//
//   Bina EXPIRE ke kya hota:
//   User ek baar request kare, fir 2 ghante baad aaye — purani entries Redis me forever rahti hain.
//   Har user ke liye memory accumulate hoti rahti → MEMORY LEAK!
//   EXPIRE se guarantee hai: agar 60s me koi request nahi aayi toh key khud saaf ho jaati hai.
//
// -----------------------------------------------------------------------------------
// ZRANGE key start stop WITHSCORES
// -----------------------------------------------------------------------------------
//   Index range se members fetch karta hai (lowest → highest score order me).
//   Index 0 = sabse purana member (lowest score = oldest timestamp)
//   WITHSCORES = [member, score, member, score, ...] format me return karta hai
//
//   redis.zrange("ratelimit:user1:chatAgent", 0, 0, "WITHSCORES")
//   → ["1720000010000", "1720000010000"]  (oldest member aur uska score)
//
//   Retry-After calculation:
//   oldest = 1720000010000  (50 seconds pehle)
//   now    = 1720000060000
//   retryAfterMs = WINDOW_MS - (now - oldest) = 60000 - 50000 = 10000ms = 10 seconds
//   Matlab 10 seconds baad oldest request expire ho jaayegi aur ek slot free hoga.
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