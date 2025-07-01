import { connection } from "@/app/lib/connection";
import { auth } from "@/app/lib/firebase/firebaseAdmin";
import { getUser, updateUser } from "@/app/lib/firebase/userUtils";
import { blockchainTaskQueue } from "@/app/lib/taskQueue";
import { ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import { NextRequest, NextResponse } from "next/server";
import { Payment } from "../../../../../shared/types/user";

const LAMPORTS_PER_SOL = 1000000000;
const SUBSCRIPTION_MONTHLY_COST = 0.25;

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
    const destinationDelta = (destinationWalletPostBalance - destinationWalletPreBalance) / LAMPORTS_PER_SOL;

    if (sourceDelta >= solPayment && destinationDelta >= solPayment) {
      return {
        signature: transaction.transaction.signatures[0],
        amountPayedSol: destinationDelta,
        sourceWallet: walletSource,
        destinationWallet: walletDestination,
        unixTimestampMs: timestamp ? timestamp * 1000 : Date.now(),
      };
    }
  }

  return undefined;
}

function calculateSubscriptionEndDate(
  payments: Payment[],
  monthlyCostSol: number
): number | undefined {
  const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

  const sorted = payments
    .slice()
    .sort((a, b) => a.unixTimestampMs - b.unixTimestampMs);

  let subscriptionEnd = 0;
  let accumulatedSol = 0;

  for (const payment of sorted) {
    accumulatedSol += payment.amountPayedSol;
    while (accumulatedSol >= monthlyCostSol) {
      const baseTime = Math.max(subscriptionEnd, payment.unixTimestampMs);
      subscriptionEnd = baseTime + MONTH_IN_MS;
      accumulatedSol -= monthlyCostSol;
    }
  }

  return subscriptionEnd || undefined;
}

export async function GET(request: NextRequest) {
  try {
    const destinationWallet = request.nextUrl.searchParams.get("destinationWallet");
    if (!destinationWallet) {
      console.error("Destination wallet required");
      return NextResponse.json({ error: "destinationWallet is required" }, { status: 400 });
    }

    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      console.error("User id required");
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

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

    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: "User does not exist" }, { status: 500 });
    }

    const existingPayments: Payment[] = user.payments || [];

    const sigsForVault = await connection.getSignaturesForAddress(
      new PublicKey(destinationWallet),
      { limit: 300 },
      "confirmed"
    );

    const sigsNoErr = sigsForVault.filter((sig) => !sig.err).map((sig) => sig.signature);

    const transactions = await Promise.all(
      sigsNoErr.map((sig) =>
        blockchainTaskQueue.addTask(() =>
          connection.getParsedTransaction(sig, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 1,
          })
        )
      )
    );

    const newPayments: Payment[] = [];

    for (const transaction of transactions) {
      if (transaction != null) {
        const accountKeys = transaction.transaction.message.accountKeys.map((k) => k.pubkey.toString());
        const destinationIdx = accountKeys.findIndex((k) => k === destinationWallet);
        if (destinationIdx === -1) continue;

        for (let i = 0; i < accountKeys.length; i++) {
          if (i === destinationIdx) continue;

          const sourceWallet = accountKeys[i];
          const payment = getPaymentFromTransaction(transaction, sourceWallet, destinationWallet, 0);
          if (
            payment &&
            !existingPayments.some((p) => p.signature === payment.signature) &&
            !newPayments.some((p) => p.signature === payment.signature)
          ) {
            console.log(chalk.green("Valid payment detected: " + JSON.stringify(payment)));
            newPayments.push(payment);
            break; // only consider first match
          }
        }
      }
    }

    const allPayments = [...existingPayments, ...newPayments];
    const subscriptionEndDate = calculateSubscriptionEndDate(allPayments, SUBSCRIPTION_MONTHLY_COST);

    user.payments = allPayments;
    user.subscriptionEndTimesampMs = subscriptionEndDate;

    await updateUser(userId, user);

    return NextResponse.json(
      {
        payments: user.payments,
        subscriptionEndTimesampMs: user.subscriptionEndTimesampMs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error fetching token data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
