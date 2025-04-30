'use server'

import { CryptoDataDb, getCryptoPriceBySymbolDB } from "../lib/utils/cryptoPrice"

export async function getCryptoPriceAction(symbol: string): Promise<CryptoDataDb | undefined> {
    return getCryptoPriceBySymbolDB(symbol)
}