import { TokenMetadata } from "./token";

export type AlarmType = "normal" | "critical" | null 

export interface RecentNotification {
    uid?: string;
    mint?: string;
    timestamp: number;
    percentageBreached: number;
    minutes: number;
    percentChange: number;
    alertType: AlarmType;
    notificationTitle?: string;
    notificationBody?: string;
    image?: string;
  }
  
  export interface TrackedToken {
    mint: string;
    isNotificationsOn: boolean;
    tokensOwned: number;
    metadata?: TokenMetadata
  }
  
  export type AlarmPreset = "left" | "right" | "center";

  export interface Payment {
    signature: string;
    amountPayedSol: number;
    sourceWallet: string;
    destinationWallet: string;
    // SOL stores timestamp as seconds and we convert it to Ms
    unixTimestampMs: number
  }

  export interface Wallet {
    pubkey: string;
    payments?: Payment[];
    subscriptionEndTimesampMs?: number;
  }

  export interface ReferralCodeUses {
    timestampUsedMs: number;
    signupUid: string;
    signupWallet: string;
  }

  export interface ReferralCode {
    timestampCreatedMs: number;
    referralCode: string;
    wallet: string;
    uses: ReferralCodeUses[];
  }

  export interface SirenUser {
    uid: string;
    email?: string;
    wallets?: string[];
    userWallets?: Wallet[];
    tokens?: string[];
    fcmTokens?: string[];
    trackedTokens?: TrackedToken[];
    alarmPreset: AlarmPreset;
    isNotificationsOn: boolean;
    recentNotifications?: Record<string, RecentNotification>;
    referralCode?: ReferralCode;
    userSirenWallet?: string;
  }