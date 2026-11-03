import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
  commandTimeout: 1500,
  connectTimeout: 2000,
  enableOfflineQueue: false
});
redis.on("connect",()=>{
    console.log("Redis connected successfully");
})
redis.on("error",(err)=>{
    console.log("Redis error:",err);
})
export default redis;
