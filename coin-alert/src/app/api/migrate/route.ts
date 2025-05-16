import { Token } from "@/app/lib/firebase/tokenUtils";
import { adminDB } from "@/app/lib/firebase/firebaseAdmin";
import { createClient } from "redis";
import { NextRequest, NextResponse } from "next/server";

async function getRedisClient(){
    const redisClient = await createClient({
        url: process.env.REDIS_URL,
    }).connect();
    return redisClient
}


// Helper: Convert token to Redis hash
function tokenToRedisHash(token: Token): Record<string, string> {
  const hash: Record<string, string> = {};
  if (token.tokenData) {
    Object.entries(token.tokenData).forEach(([key, value]) => {
      if (value != null && key !== "tokenMetadata") hash[key] = String(value);
    });
    if (token.tokenData.tokenMetadata) {
      Object.entries(token.tokenData.tokenMetadata).forEach(([key, value]) => {
        if (value != null) hash[`tokenMetadata:${key}`] = String(value);
      });
    }
  }
  if (token.isDead != null) hash.isDead = String(token.isDead);
  return hash;
}

// Main migration function
async function migrateTokens({ tokenId, migrateAll = false }: { tokenId?: string; migrateAll?: boolean }) {
  try {
    const redisClient = await getRedisClient()

    let tokensToMigrate: { id: string; data: Token }[] = [];

    if (migrateAll) {
      const snapshot = await adminDB.collection("uniqueTokens").get();
      tokensToMigrate = snapshot.docs.map((doc) => ({
        id: doc.id,
        data: doc.data() as Token,
      }));
    } else if (tokenId) {
      const doc = await adminDB.collection("uniqueTokens").doc(tokenId).get();
      if (!doc.exists) {
        console.error(`❌ Token ${tokenId} not found in Firestore.`);
        return;
      }
      tokensToMigrate.push({ id: doc.id, data: doc.data() as Token });
    } else {
      console.error("❌ You must provide a tokenId or set migrateAll to true.");
      return;
    }

    for (const { id, data } of tokensToMigrate) {
      const key = `token:${id}`;
      await redisClient.hSet(key, tokenToRedisHash(data));

      if (data.prices) {
        const priceKey = `prices:${id}`;
        for (const priceData of data.prices) {
          await redisClient.zAdd(priceKey, {
            score: priceData.timestamp,
            value: String(priceData.price),
          });
        }
        await redisClient.expire(priceKey, 2 * 60 * 60);
      }

      // Show results
      const hash = await redisClient.hGetAll(`token:${id}`);
      const prices = await redisClient.zRangeWithScores(`prices:${id}`, 0, -1);
      const ttl = await redisClient.ttl(`prices:${id}`);

      console.log(`✅ Migrated token: ${id}`);
      console.log("🔹 Token Hash:", hash);
      console.log("🔹 Prices:", prices);
      console.log(`🔹 TTL: ${ttl}s\n`);
    }

    await redisClient.quit();
  } catch (error) {
    console.error("❌ Migration error:", error);
  }
}

export async function GET(request: NextRequest) {
    console.log(request)
    await migrateTokens({ tokenId: "2Sg6jwTiNEv4WQmp24enA9CHePJfT1FbSE1e21cJpump" });
    return NextResponse.json({ message: "Migrating once"});
    
}
