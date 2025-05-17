import { createClient } from "redis";

export async function getRedisClient() {
  const redisClient = await createClient({
    url: process.env.REDIS_URL,
  }).connect();
  return redisClient;
}