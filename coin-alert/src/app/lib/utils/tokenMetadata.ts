import { fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from "@metaplex-foundation/umi";
import { umi } from '../connection';
import { blockchainTaskQueue } from '../taskQueue';
import { TokenMetadata } from '../firebase/tokenUtils';


interface URIMetadata {
  name?: string;
  image?: string;
  symbol?: string;
  description?: string;
}


export async function fetchJsonFromUri(uri: string): Promise<URIMetadata | undefined> {
  try {
    const response = await fetch(uri);

    if (!response.ok) {
      console.error(`Failed to fetch JSON from ${uri}: ${response.status} ${response.statusText}`);
      return undefined
    }

    const data: URIMetadata = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching JSON:", error);
    return undefined
  }
}


// 🔹 Fetch Metadata from Metaplex
async function getTokenMetadataMetaplex(token: string) {
  const mint = publicKey(token);
  try {
    const asset = await fetchDigitalAsset(umi, mint);
    //console.log(chalk.green(`✅ Got metadata for token: ${token}`));
    return {
      name: asset.metadata.name,
      symbol: asset.metadata.symbol,
      uri: asset.metadata.uri
    };
  } catch (error) {
    console.error(`❌ Error getting Metaplex metadata for ${token}:`, error);
    return null;
  }
}

// 🔹 Get Metadata from Blockchain (Fallback)
export async function getTokenMetadataFromBlockchain(token: string): Promise<TokenMetadata | undefined> {
  const metaplexMetadata = await blockchainTaskQueue.addTask(() => getTokenMetadataMetaplex(token));

  if (metaplexMetadata){
      // TODO: Once we setup images in notis, retest this code. Now its failing a lot and needs to not be running
    const parsedMetadata: URIMetadata | undefined = await fetchJsonFromUri(metaplexMetadata.uri)
    const tokenMetadata: TokenMetadata = {
      image: parsedMetadata?.image,
      description: parsedMetadata?.description,
      name: parsedMetadata?.name,
      symbol: parsedMetadata?.symbol,
      uri: metaplexMetadata.uri
    }
    return tokenMetadata
  } 
  return undefined
}