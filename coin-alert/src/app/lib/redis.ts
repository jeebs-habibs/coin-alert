import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>

export async function getRedisClient(): Promise<RedisClient> {
  const redisClient = await createClient({
    url: process.env.REDIS_URL,
  }).connect();
  return redisClient;
}


// class RedisSingleton {
//   private static instance: RedisClient | null = null;

//   static async getClient(): Promise<RedisClient> {
//     if (!RedisSingleton.instance || RedisSingleton.instance == null) {
//       const client = createClient({
//         url: process.env.REDIS_URL,
//       });

//       client.on("error", (err) => {
//         console.error("❌ Redis Client Error:", err);
//       });

//       await client.connect()
//       RedisSingleton.instance = client;
//     }

//     if(RedisSingleton.instance == null || !RedisSingleton){
//         throw Error("ERROR CONNECTING TO REDIS")
//     }

//     return RedisSingleton.instance;
//   }

//   static async disconnect(): Promise<void> {
//     if (RedisSingleton.instance) {
//       await RedisSingleton.instance.quit();
//       RedisSingleton.instance = null;
//     }
//   }
// }

// export default RedisSingleton;
