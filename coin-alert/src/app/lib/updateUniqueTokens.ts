import { web3 } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, ParsedInstruction, ParsedTransactionWithMeta, PartiallyDecodedInstruction, PublicKey, TokenAmount } from "@solana/web3.js";
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase/firebase";

interface Wallet {
  name: string;
  address: string;
  emoji: string;
  tags: string[];
}

type TransactionType = 'buy' | 'sell' | ''

interface WhaleData {
  address: string;
  name: string;
  solOwned: number;
  tokenOwned: number;
}

interface TokenAccountData {
  info: TokenAccountInfo
  "type": string;
}

interface TokenAccountInfo {
  isNative: boolean;
  mint: string;
  owner: string;
  state: string;
  tokenAmount: TokenAmount;
}

interface MintInfo {
  solPrice: number;
  usdPrice?: number;
  priceLastUpdatedAt: Date;
  pool: PoolType;
  whaleDataList: WhaleData[];
}

type PoolType = "pump" | "raydium"

interface RaydiumTransferInfo {
  amount: string;
  authority: string;
  destination: string;
  source: string;
}

interface ParsedRaydiumTransfer {
  info: RaydiumTransferInfo;
  type: string;
}

interface InitializeAccountInfo {
  account: string;
  mint: string;
  owner: string;
  rentSysvar: string;
}

interface InitializeAccountIxData {
  type: string;
  info: InitializeAccountInfo;
}



interface DecodedRaydiumTransfer {
  amount: bigint;
  authority: string;
  destination: string;
  source: string;
}

const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
const RAYDIUM_SWAP_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
const WSOL_ADDRESS = "So11111111111111111111111111111111111111112"

function getRelevantRaydiumInnerInstructions(transaction: ParsedTransactionWithMeta | null){
  let relevantIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = []

  transaction?.meta?.innerInstructions?.forEach((ii: web3.ParsedInnerInstruction) => {
      //console.log("--Inner instruction idx: "+ ii.index)
      ii.instructions.forEach((iii) => {
          //console.log('----Inner inner instruction program id: ' + iii.programId)            
          if(transaction?.transaction?.message?.instructions[ii.index].programId.equals(RAYDIUM_SWAP_PROGRAM)){
              //console.log("Found Raydium swap instruction with program id: " + iii.programId)
              relevantIxs.push(iii)
          }
      })
  })
  return relevantIxs
}

function getRelevantPumpInnerInstructions(transaction: ParsedTransactionWithMeta | null){
  let relevantIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = []
  transaction?.meta?.innerInstructions?.forEach((ii: web3.ParsedInnerInstruction) => {
      //console.log("--Inner instruction idx: "+ ii.index)
      ii.instructions.forEach((iii) => {
          //console.log('----Inner inner instruction program id: ' + iii.programId)            
          if(iii.programId.equals(PUMP_FUN_PROGRAM)){
              //console.log("Found a Pump trade instruction with programId: " + iii.programId)
              relevantIxs.push(iii)
          }
      })
  })
  return relevantIxs
}

function getWrappedSolAccount(transaction: ParsedTransactionWithMeta | null): string | null{
  const instructions = transaction?.transaction.message.instructions || []
  for (const ix of instructions){
      if(ix.programId.equals(TOKEN_PROGRAM)){
          const parsedIx = ix as ParsedInstruction
          const partialIx = ix as PartiallyDecodedInstruction
          const parsedIxData: InitializeAccountIxData = parsedIx?.parsed
          // console.log("Program name: " + parsedIx.program)
          // console.log(partialIx.accounts)
          if(parsedIxData?.info?.mint == WSOL_ADDRESS){
              // console.log(JSON.stringify(parsedIx?.parsed))
              // console.log("account is: " + parsedIxData.info.account)
              return parsedIxData.info.account
          }
      }
  }
  return null
}


async function getRaydiumSwapSOLPrice(transactionRaydiumIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[], wrappedSolAccount: string | null){
  let tradeType: TransactionType = ""
  let amountInSol = 0
  let tokenAmount = 0
  let mint = ""
  
  const raydiumIx1 = transactionRaydiumIxs[0] as PartiallyDecodedInstruction
  const raydiumIx1Parsed = transactionRaydiumIxs[0] as ParsedInstruction
  const raydiumIx2 = transactionRaydiumIxs[1] as PartiallyDecodedInstruction
  const raydiumIx2Parsed = transactionRaydiumIxs[1] as ParsedInstruction
  const parsedIx1Data: ParsedRaydiumTransfer = raydiumIx1Parsed.parsed
  const parsedIx2Data: ParsedRaydiumTransfer = raydiumIx2Parsed.parsed

  //console.log("Raydium parsed instruction program: " + raydiumIx1Parsed.program)
  //console.log("Raydium parsed instruction amount: " + parsedIx1Data.info.amount)
  if(parsedIx1Data.info.source == wrappedSolAccount && parsedIx1Data.info.authority == wallet.address){
      // This indicates user is transferring WSOL into the pool, indicating a buy
      tradeType = "buy"
      amountInSol = parseInt(parsedIx1Data.info.amount)/LAMPORTS_IN_SOL
      tokenAmount = parseInt(parsedIx2Data.info.amount)/MILLION
      // const tokenAccount = await getAccount(connection, new PublicKey(parsedIx2Data.info.destination))
      // mint = tokenAccount.mint.toString()
      // TODO: Maybe remove this loop and just call both instructions directly. I believe if this is ran it will say yes to sell in this if, then yes to buy in the else once it gets to the next instruction.

  } else {
      // If no sell then buy ;)
      tradeType = "sell"
      amountInSol = parseInt(parsedIx2Data.info.amount)/LAMPORTS_IN_SOL
      tokenAmount = parseInt(parsedIx1Data.info.amount)/MILLION
      // const tokenAccount = await getAccount(connection, new PublicKey(parsedIx1Data.info.source))
      // mint = tokenAccount.mint.toString()
  }
}

async function getTokenPrice(token: string) {
  // Get latest transaction from token pool 
  // Parse if its a raydium or pump token
  // Get sol amount from latest swap
  // Return sol amount, pool, and timestamp
  try {
    const connection = new Connection(process.env.RPC_ENDPOINT || "")
    
    const signatures = await connection.getSignaturesForAddress(new PublicKey(token), {limit: 1})
    const signatureList = signatures.map((a) => a.signature)

    const transactions = await connection.getParsedTransactions(signatureList, { maxSupportedTransactionVersion: 0 });

    for (const transaction of transactions){
      // Is it a raydium or pump swap

      const transactionPumpIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = getRelevantPumpInnerInstructions(transaction)
      const transactionRaydiumIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = getRelevantRaydiumInnerInstructions(transaction)
      const wrappedSolAccount = getWrappedSolAccount(transaction)
      if(transactionRaydiumIxs?.length){
        const price = getRaydiumSwapSOLPrice(transactionRaydiumIxs, wrappedSolAccount)
        return {solPrice: price, pool: "raydium"}
      }
      if(pumpIxs){
        return {}
      }
      throw new Error("No price data found for token")
      

    }
  } catch(e) {
    console.error("Error getting price data for token " + token + ": " + e)
  }
  
}

// 🔹 Function to Store Token Price in Firestore
export async function storeTokenPrice(token: string, price: number) {
  try {
    const tokenDocRef = doc(db, "uniqueTokens", token);
    const pricesCollectionRef = collection(tokenDocRef, "prices"); // Subcollection for price history

    const timestamp = Date.now(); // Store timestamp in milliseconds

    // 🔹 Store price data
    await setDoc(doc(pricesCollectionRef, timestamp.toString()), {
      price,
      timestamp,
    });

    console.log(`✅ Price stored for ${token}: $${price}`);

    // 🔹 Clean up old prices (Keep only last 60 minutes)
    await deleteOldPrices(token);
  } catch (error) {
    console.error(`❌ Error storing price for ${token}:`, error);
  }
}

// 🔹 Function to Delete Prices Older Than 1 Hour
async function deleteOldPrices(token: string) {
  try {
    const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour ago in milliseconds
    const tokenDocRef = doc(db, "uniqueTokens", token);
    const pricesCollectionRef = collection(tokenDocRef, "prices");

    const oldPricesQuery = query(pricesCollectionRef, orderBy("timestamp"));
    const querySnapshot = await getDocs(oldPricesQuery);

    querySnapshot.forEach(async (docSnap) => {
      if (docSnap.data().timestamp < oneHourAgo) {
        await deleteDoc(docSnap.ref);
        console.log(`🗑 Deleted old price data for ${token}`);
      }
    });
  } catch (error) {
    console.error(`❌ Error deleting old prices for ${token}:`, error);
  }
}


interface TokenAccountData {
    info: TokenAccountInfo
    "type": string;
}

interface TokenAccountInfo {
    isNative: boolean;
    mint: string;
    owner: string;
    state: string;
    tokenAmount: TokenAmount;
}

// 🔹 Function to Fetch All Unique Tokens and Store in Firestore
export async function updateUniqueTokens() {
  try {
    console.log("🔄 Updating unique tokens...");
    const connection = new Connection(process.env.RPC_ENDPOINT || "")

    // 🔹 1️⃣ Fetch All Users' Wallets
    const usersSnapshot = await getDocs(collection(db, "users"));
    const uniqueTokensSet = new Set<string>(); // Use a Set to avoid duplicates

    const uniqueWallets = new Set<string>();

    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      if (userData.wallets && Array.isArray(userData.wallets)) {
        userData.wallets.forEach((wallet) => uniqueWallets.add(wallet));
      }
    });


    for (const wallet of uniqueWallets){
        const publicKey = new PublicKey(wallet)
        const tokenAccountsForAddress = await connection.getParsedTokenAccountsByOwner(publicKey, {programId: TOKEN_PROGRAM_ID})  
        tokenAccountsForAddress.value.forEach((value) => {
            const tokenAccountData: TokenAccountData = value.account.data.parsed
            if(tokenAccountData.info.tokenAmount.uiAmount || 0 > 0){
                uniqueTokensSet.add(tokenAccountData.info.mint)
            }

        })  
    }

    // 🔹 2️⃣ Store Unique Tokens in Firestore
    for (const token of uniqueTokensSet) {
      // TODO: Add fetching of price data here and store in db
      // getTokenPrice()
      // storeTokenPrice()
      const tokenDocRef = doc(db, "uniqueTokens", token);
      await setDoc(tokenDocRef, { lastUpdated: new Date() }, { merge: true }); // Merge ensures we don’t overwrite
    }


    console.log("✅ Unique tokens updated in Firestore.");
  } catch (error) {
    console.error("❌ Error updating unique tokens:", error);
  }
}
