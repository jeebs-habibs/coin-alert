import * as web3 from "@solana/web3.js";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { SirenUser, SirenUserWallet } from "../../shared/types/user";
dotenv.config();

if(!process.env.RPC_ENDPOINT?.length){
  throw new Error("ERROR: Cannot conncet to QuickNode RPC node.")
}

const connection = new web3.Connection(process.env.RPC_ENDPOINT)

const COLLECTION_WALLET = new web3.PublicKey("6rNouRR76vA78M2HYopboEqkxd5mvdTGj9fN6d4Brujs")

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const adminDB = admin.firestore();

async function getAllUsers(): Promise<SirenUser[]> {
  try {
    const usersCollectionRef = adminDB.collection("users");
    const usersSnapshot = await usersCollectionRef.get();

    const users: SirenUser[] = usersSnapshot.docs.map((doc) => {
      //console.log("doc data: " + JSON.stringify(doc.data()))
      return doc.data() as SirenUser}
    );
    console.log(`✅ Fetched ${users.length} users from Firestore`);

    return users;
  } catch (error) {
    throw Error("❌ Error fetching users:" + error);
  }
}

async function getSirenUserWallet(publicKey: string){
    try {
        console.log("Fetching siren user wallet from Firestore: " + publicKey);
        const docRef = adminDB.collection("sirenWallets").doc(publicKey);
        const docSnapshot = await docRef.get();
    
        if (!docSnapshot.exists) {
          return null;
        }
    
        return docSnapshot.data() as SirenUserWallet;
      } catch (error) {
        console.error(`❌ Error fetching siren user wallet ${publicKey}:`, error);
        return undefined;
      }
}

async function retrievePayment(){
  const users = await getAllUsers()
  
  for(const user of users){
    try {
      if(user.userSirenWallet){
        const balanceLamports = await connection.getBalance(new web3.PublicKey(user.userSirenWallet))
        if(balanceLamports > 5000){
          const sirenUserWallet = await getSirenUserWallet(user.userSirenWallet)
          if(sirenUserWallet){
            const from = web3.Keypair.fromSecretKey(new Uint8Array(sirenUserWallet.secretKey));
            const amountToSend = balanceLamports - 5000
            console.log(`Sending ${amountToSend / web3.LAMPORTS_PER_SOL} SOL from ${from.publicKey} -> ${COLLECTION_WALLET.toString()}`)
            const transaction = new web3.Transaction().add(
              web3.SystemProgram.transfer({
                fromPubkey: from.publicKey,
                toPubkey: COLLECTION_WALLET,
                lamports: balanceLamports - 5000
              }),
              );
              
              // Sign transaction, broadcast, and confirm
              const signature = await web3.sendAndConfirmTransaction(
                  connection,
                  transaction,
                  [from],
              );
              console.log('SIGNATURE', signature);
          }
        } else {
          console.log("User siren wallet is empty")
        }
      } else {
        console.log("User " + user.uid + " does not have a siren user wallet created.")
      }
    } catch(e) {
      console.error("Error retrieveing payment from user: " + user.uid  + ". Error: " + e)
    }
  }
}

retrievePayment()