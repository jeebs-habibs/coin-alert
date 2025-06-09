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
    timestamp: number
  }

  export interface Wallet {
    pubkey: string;
    payments?: Payment[];
    subscriptionEndDate?: Date;
  }

  type ReferralCode = "nach" | "orangie" | "cupsey"

  export interface SirenUser {
    uid: string;
    email?: string;
    wallets?: string[];
    userWallets?: Wallet[];
    tokens?: string[];
    trackedTokens?: TrackedToken[];
    alarmPreset: AlarmPreset;
    isNotificationsOn: boolean;
    recentNotifications?: Record<string, RecentNotification>;
    referralCode?: ReferralCode;
  }