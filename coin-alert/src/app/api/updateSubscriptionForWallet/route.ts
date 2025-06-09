import { connection } from "@/app/lib/connection";
import { auth } from "@/app/lib/firebase/firebaseAdmin";
import { getUser, updateUser } from "@/app/lib/firebase/userUtils";
import { ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import { NextRequest, NextResponse } from "next/server";
import { Payment, Wallet } from "../../../../../shared/types/user";

const LAMPORTS_PER_SOL = 1000000000
const SUBSCRIPTION_MONTHLY_COST = .25
const SIREN_VAULT_WALLET =  "Cnn1AyuYH1cKNtKFM5yXYy6GAMgtgh7rLinzeSkbzwnm"

function getPaymentFromTransaction(
    transaction: ParsedTransactionWithMeta,
    walletSource: string,
    walletDestination: string,
    solPayment: number
  ): Payment | undefined {
    const timestamp = transaction.blockTime;
    const transactionAccounts = transaction.transaction.message.accountKeys.map((val) => val.pubkey.toString());
    const idxSourceWallet = transactionAccounts.findIndex((val) => val === walletSource);
    const idxDestinationWallet = transactionAccounts.findIndex((val) => val === walletDestination);
  
    const sourceWalletPreBalance = transaction.meta?.preBalances[idxSourceWallet];
    const sourceWalletPostBalance = transaction.meta?.postBalances[idxSourceWallet];
  
    const destinationWalletPreBalance = transaction.meta?.preBalances[idxDestinationWallet];
    const destinationWalletPostBalance = transaction.meta?.postBalances[idxDestinationWallet];
  
    if (
      sourceWalletPreBalance !== undefined &&
      sourceWalletPostBalance !== undefined &&
      destinationWalletPreBalance !== undefined &&
      destinationWalletPostBalance !== undefined
    ) {
      const sourceDelta = (sourceWalletPreBalance - sourceWalletPostBalance) / LAMPORTS_PER_SOL;
      console.log("Source delta: " + sourceDelta)
      const destinationDelta = (destinationWalletPostBalance - destinationWalletPreBalance) / LAMPORTS_PER_SOL;
      console.log("Destination delta: " + destinationDelta)
  
      if (sourceDelta >= solPayment && destinationDelta >= solPayment) {
        return {
          signature: transaction.transaction.signatures[0],
          amountPayedSol: destinationDelta,
          sourceWallet: walletSource,
          destinationWallet: walletDestination,
          timestamp: timestamp ?? 0,
        };
      }
    }
  
    return undefined;
}

async function getNewPaymentsFromWallet(existingPayments: Payment[], sourceWallet: string, destinationWallet: string, solAmount: number): Promise<Payment[]>{
    const payments = []
    const sigsForVault = await connection.getSignaturesForAddress(new PublicKey(destinationWallet), undefined, "confirmed")
    const sigsNoErr = sigsForVault.filter((sig) => !sig.err).map((sig) => sig.signature)
    for(const sig of sigsNoErr){
        const transaction = await connection.getParsedTransaction(sig, {commitment: "confirmed", maxSupportedTransactionVersion: 1})
        console.log("Got transaction: " + JSON.stringify(transaction))
        if(transaction != null){
            const payment = getPaymentFromTransaction(transaction, sourceWallet, destinationWallet, solAmount)
            if(payment && !existingPayments.includes(payment)){
                console.log(chalk.green("Valid payment detected: " + JSON.stringify(payment)))
                payments.push(payment)
            }
        }
    }
    return payments
}

function calculateSubscriptionEndDate(
    payments: Payment[],
    monthlyCostSol: number,
    sourceWallet: string
    ): Date | null {
    const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

    // Filter payments from the target wallet and sort ascending by time
    const userPayments = payments
        .filter(p => p.sourceWallet === sourceWallet)
        .sort((a, b) => a.timestamp - b.timestamp);

    if (userPayments.length === 0) return null;

    let subscriptionEnd = 0; // in ms
    let accumulatedSol = 0;

    for (const payment of userPayments) {
        accumulatedSol += payment.amountPayedSol;

        while (accumulatedSol >= monthlyCostSol) {
        // Determine when the new subscription month should start
        const baseTime = Math.max(subscriptionEnd, payment.timestamp * 1000);
        subscriptionEnd = baseTime + MONTH_IN_MS;
        accumulatedSol -= monthlyCostSol;
        }
    }

    return subscriptionEnd ? new Date(subscriptionEnd) : null;
}

export async function GET(request: NextRequest) {
  try {
    // 👇 You could use the UID to scope the token fetching if needed
    const sourceWallet = request.nextUrl.searchParams.get("sourceWallet");
    if (!sourceWallet) {
        return NextResponse.json({ error: "sourceWallet is required" }, { status: 400 });
    }

    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    console.log("🔐 Verifying user...");

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];

    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
        console.log("✅ User verified:", decodedToken.uid);
    } catch (error) {
        console.error("❌ Invalid token:", error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUser(userId)
    if(user == null){
        return NextResponse.json({ error: "User does not exist" }, { status: 500 });
    }

    const userPaymentsFromWallet = user?.userWallets?.length ? user.userWallets.find((wallet) => wallet.pubkey == sourceWallet)?.payments || [] : []
    const userSourceWalletIdx: number | undefined = user?.userWallets?.length ? user.userWallets.findIndex((wallet) => wallet.pubkey == sourceWallet) : undefined

    // Setting sol payemnt to 0 so we get all payments
    const newPayments = await getNewPaymentsFromWallet(userPaymentsFromWallet, sourceWallet, SIREN_VAULT_WALLET, 0)
    const allPayments = [...newPayments, ...userPaymentsFromWallet]
    const subscriptionEndDate = calculateSubscriptionEndDate(allPayments, SUBSCRIPTION_MONTHLY_COST, sourceWallet)

    if(subscriptionEndDate != null){
        const newWallet: Wallet = {pubkey: sourceWallet, subscriptionEndDate: subscriptionEndDate, payments: allPayments}
        if(!user.userWallets){
            user.userWallets = [newWallet]
        } else if (user.userWallets && userSourceWalletIdx) {
            user.userWallets[userSourceWalletIdx] = newWallet
        } else if (user.userWallets && !userSourceWalletIdx){
            user.userWallets.push(newWallet)
        }
        await updateUser(userId, user)
        return NextResponse.json(newWallet, { status: 200 });
    }

    return NextResponse.json({}, { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching token data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
