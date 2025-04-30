'use server';

import { getToken, Token } from "../lib/firebase/tokenUtils";

export async function getTokenAction(id: string): Promise<Token | undefined> {
  try {
    console.log("Getting token with id: " + id)
    const token = await getToken(id);
    if (token && 'lastUpdated' in token) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lastUpdated, ...updatedToken } = token;
      return updatedToken as Token;
    }
    return token;
  } catch (error) {
    console.error('Failed to fetch token:', error);
    return undefined;
  }
}