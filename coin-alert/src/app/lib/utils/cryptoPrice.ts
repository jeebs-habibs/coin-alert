import { adminDB } from "../firebase/firebaseAdmin";

export interface CryptoPriceResponse {
    priceUsd: number;
    timestamp: number;
}


export interface CryptoDataDb {
    priceUsd: number;
    timestamp: number;
}

async function updateCryptoPriceById(symbol: string, cryptoData: CryptoDataDb): Promise<void> {
    try {
      const docRef = adminDB.collection('cryptoPrices').doc(symbol);
  
      // Overwrite the document with new data
      await docRef.set({
        priceUsd: cryptoData.priceUsd,
        timestamp: cryptoData.timestamp,
      });
  
      console.log(`Document with ID: ${symbol} successfully updated`);
    } catch (error) {
      console.error('Error updating crypto price:', error);
      throw new Error('Failed to update crypto price');
    }
  }
  
export async function getCryptoPriceBySymbolDB(symbol: string): Promise<CryptoDataDb | undefined> {
    try {
      const docRef = adminDB.collection('cryptoPrices').doc(symbol);
      const docSnap = await docRef.get();
  
      if (!docSnap.exists) {
        console.log(`No document found with id: ${symbol}`);
        return undefined;
      }
  
      const data = docSnap.data() as CryptoDataDb;
      return {
        priceUsd: data.priceUsd,
        timestamp: data.timestamp
      };
    } catch (error) {
      console.error('Error fetching crypto price:', error);
      throw new Error('Failed to fetch crypto price');
    }
  }
const ONE_HOUR = 1000 * 60 * 60


export async function getCryptoPrice(symbol: string): Promise<CryptoPriceResponse | undefined> {

    const dbPrice = await getCryptoPriceBySymbolDB("SOL")
    if(dbPrice && (Date.now() - dbPrice.timestamp) < ONE_HOUR){
        console.log("Returning " + symbol + " price from db: " + JSON.stringify(dbPrice))
        return dbPrice
    }

    if(process.env.CMC_API_KEY == undefined){
        return undefined
    }
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
        },
      });
  
      if (!response.ok) {
        throw new Error(`Error fetching Crypto price: ${response.statusText}`);
      }
  
      const data = await response.json();
      const typedResponse: CryptoPriceResponse = { priceUsd: data.data?.SOL?.quote?.USD?.price, timestamp: Date.now() }
      updateCryptoPriceById(symbol, typedResponse)
      console.log("Fetched price from CMC: " + JSON.stringify(typedResponse))
      return typedResponse
    } catch (error) {
      console.error(error);
      return undefined
    }
}