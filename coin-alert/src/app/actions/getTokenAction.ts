'use server';

import { Token } from "../lib/firebase/tokenUtils";
import { getRedisClient } from "../lib/redis";
import { getTokenPrices } from "../lib/redis/prices";
import { getTokenFromRedis } from "../lib/redis/tokens";

export async function getTokenAction(id: string): Promise<Token | undefined> {
  try {
    const redisClient = await getRedisClient()
    const token = await getTokenFromRedis(id, redisClient)
    const prices = await getTokenPrices(id, redisClient)
    return {...token, prices}
  } catch (error) {
    console.error('Failed to fetch token:', error);
    return undefined;
  }
}