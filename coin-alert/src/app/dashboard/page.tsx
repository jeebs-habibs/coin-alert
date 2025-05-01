"use client";

import Image from "next/image";
import styles from "./page.module.css";
import { useAuth } from "../providers/auth-provider";
import { useEffect, useState, useMemo } from "react";
import { PriceData, Token } from "../lib/firebase/tokenUtils";
import { getTokenAction } from "../actions/getTokenAction";
import { getCryptoPriceAction } from "../actions/getCryptoPrice";
import { CryptoDataDb } from "../lib/utils/cryptoPrice";
import { useRouter } from "next/navigation";
import { shortenString } from "../lib/utils/stringUtils";
import { RecentNotification } from "../lib/firebase/userUtils";

// Simple in-memory cache
const cache = {
  solPrice: { data: undefined as CryptoDataDb | undefined, timestamp: 0 },
  tokens: new Map<string, Token | undefined>(),
  CACHE_DURATION: 5 * 60 * 1000, // Cache for 5 minutes
};

// Helper function to format timestamp as relative time
const formatRelativeTime = (timestamp: number) => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

function getBackupNotificationBody(notification: RecentNotification): string {
  return `${notification.alertType} Alert: ${notification.percentageBreached}% threshold breached (${notification.percentChange >= 0 ? '+' : ''}${notification.percentChange.toFixed(0)}% in ${notification.minutes} min)`;
}
// Updated getMarketCapUSDFromPrices
function getMarketCapUSDFromPrices(prices: PriceData[], solPriceUSD: number): number {
  if (!prices || prices.length === 0 || !solPriceUSD) return 0;

  const latestPrice = prices
    .filter((data) => typeof data.marketCapSol === "number")
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (!latestPrice || typeof latestPrice.marketCapSol !== "number") return 0;

  const marketCapUSD = latestPrice.marketCapSol * solPriceUSD;
  return Number(marketCapUSD.toFixed(2));
}

export default function Dashboard() {
  const { user, userData, loading } = useAuth();
  
  const router = useRouter();

  useEffect(() => {
    if (user == null && !loading) {
      router.push("/");
    }
  }, [user, loading, router]);

  const [mintToTokenData, setMintToTokenData] = useState<Map<string, Token | undefined>>(new Map());
  const [solPrice, setSolPrice] = useState<CryptoDataDb | undefined>(cache.solPrice.data);

  // Memoize notifications to prevent recalculating on every render
  const notifications = useMemo(() => {
    if (!userData?.recentNotifications) return [];
    return Object.entries(userData.recentNotifications)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [userData?.recentNotifications]);

  // Fetch SOL price and token metadata once on page load
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch SOL price if not cached
        let solPriceData = cache.solPrice.data;
        if (!solPriceData) {
          solPriceData = await getCryptoPriceAction("SOL");
          cache.solPrice = { data: solPriceData, timestamp: Date.now() };
          setSolPrice(solPriceData);
        }

        // Get unique token addresses from notifications and tracked tokens
        const tokenAddresses = [
          ...new Set([
            ...(notifications.map((n) => n.id.split("_")[0])),
            ...(userData?.trackedTokens || []),
          ]),
        ];

        // Fetch only uncached tokens
        const tokensToFetch = tokenAddresses.filter((token) => !cache.tokens.has(token));
        const newMap = new Map<string, Token | undefined>();
        if (tokensToFetch.length > 0) {
          const fetchPromises = tokensToFetch.map(async (token) => {
            try {
              const tokenData = await getTokenAction(token);
              cache.tokens.set(token, tokenData);
              return { token, tokenData };
            } catch (error) {
              console.error(`Failed to fetch metadata for token ${token}:`, error);
              return { token, tokenData: undefined };
            }
          });

          const results = await Promise.all(fetchPromises);
          results.forEach(({ token, tokenData }) => {
            newMap.set(token, tokenData);
          });
        }

        // Add cached tokens to the map
        tokenAddresses.forEach((token) => {
          if (!newMap.has(token)) {
            newMap.set(token, cache.tokens.get(token));
          }
        });

        setMintToTokenData(newMap);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    if (!loading && userData) {
      fetchData();
    }
  }, [loading, userData, notifications]);

  return (
    <div className={styles.container}>
      {/* Your Tracked Assets Section */}
      <section className={styles.assetsSection}>
        <h1 className={styles.sectionTitle}>Your Tracked Assets</h1>
        <div className={styles.tokenList}>
          {userData?.trackedTokens ? (
            userData.trackedTokens.map((token, index) => {
              const tokenFromDb = mintToTokenData.get(token);
              const imageSrc = tokenFromDb?.tokenData?.tokenMetadata?.image || "/placeholder.jpg";
              return (
                <div key={index} className={styles.tokenRowWrapper}>
                  <div className={styles.tokenRow}>
                    <div className={styles.tokenInfo}>
                      <Image
                        src={imageSrc}
                        alt={`${tokenFromDb?.tokenData?.tokenMetadata?.symbol || token} logo`}
                        width={70}
                        height={70}
                        className={styles.notificationImage}
                      />
                      <div>
                        <p className={styles.tokenSymbol}>
                          {tokenFromDb?.tokenData?.tokenMetadata?.symbol || token}
                        </p>
                        <p className={styles.tokenLabel}>Market Cap</p>
                      </div>
                    </div>
                    <p className={styles.tokenMarketCap}>
                      $
                      {(getMarketCapUSDFromPrices(tokenFromDb?.prices || [], solPrice?.priceUsd || 0) / 1_000_000).toLocaleString()}
                      M
                    </p>
                  </div>
                  {index < (userData?.trackedTokens?.length || 0) - 1 && (
                    <hr className={styles.tokenSeparator} />
                  )}
                </div>
              );
            })
          ) : (
            <p className={styles.emptyState}>Your top 5 memecoin holdings will be displayed here</p>
          )}
        </div>
      </section>

      {/* Recent Notifications Section */}
      <section className={styles.watchListSection}>
        <h1 className={styles.sectionTitle}>Recent Notifications</h1>
        <div className={styles.notificationsContainer}>
          {notifications.length > 0 ? (
            notifications.map((notification, idx) => {
              const tokenMint = notification.id.split("_")[0]
              const metadata = mintToTokenData.get(tokenMint)?.tokenData?.tokenMetadata || {
                symbol: "Unknown",
                image: null,
              };
              const imageSrc = notification.image || "/placeholder.jpg";
              return (
                <div key={`${notification.id}-${idx}`} className={styles.notificationRowWrapper}>
                  <div
                    className={`${styles.notificationRow} ${
                      notification.percentChange >= 0 ? styles.positive : styles.negative
                    }`}
                    aria-label={`Notification for ${notification.notificationTitle}: ${notification.alertType} alert`}
                  >
                    <Image
                      src={imageSrc}
                      alt={`${metadata.symbol} logo`}
                      width={70}
                      height={70}
                      className={styles.notificationImage}
                    />
                    <div className={styles.notificationContent}>
                      <p className={styles.notificationHeader}>{notification?.notificationTitle || `${metadata.symbol} (${shortenString(tokenMint)})`}</p>
                      <p className={styles.notificationText}>
                        {notification.notificationBody || getBackupNotificationBody(notification)}
                      </p>
                      <p className={styles.notificationTimestamp}>
                        {formatRelativeTime(notification.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className={styles.emptyState}>No recent notifications</p>
          )}
        </div>
      </section>
    </div>
  );
}