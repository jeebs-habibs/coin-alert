"use client";

import { doc, updateDoc } from "firebase/firestore";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CiBellOff, CiBellOn } from "react-icons/ci";
import { FaChevronDown } from "react-icons/fa";
import { getCryptoPriceAction } from "../actions/getCryptoPrice";
import { getTokenAction } from "../actions/getTokenAction";
import TokenMetricDisplay from "../components/TokenMetricDisplay";
import { db } from "../lib/firebase/firebase";
import { PriceData, Token } from "../lib/firebase/tokenUtils";
import { RecentNotification, TrackedToken } from "../lib/firebase/userUtils";
import { CryptoDataDb } from "../lib/utils/cryptoPrice";
import { BILLION } from "../lib/utils/solanaUtils";
import { formatNumber, shortenString } from "../lib/utils/stringUtils";
import { useAuth } from "../providers/auth-provider";
import styles from "./page.module.css";

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
  return `${notification.alertType} Alert: ${notification.percentageBreached}% threshold breached (${
    notification.percentChange >= 0 ? "+" : ""
  }${notification.percentChange.toFixed(0)}% in ${notification.minutes} min)`;
}

export interface TokenPriceData {
  solPrice: number;
  usdPrice: number;
  solMarketCap: number;
  usdMarketCap: number;
}

// Updated getMarketCapUSDFromPrices
function getMarketCapUSDFromPrices(prices: PriceData[], solPriceUSD: number): TokenPriceData | undefined {
  if (!prices || prices.length === 0 || !solPriceUSD) return undefined;

  const latestPrice = prices
    .filter((data) => typeof data.marketCapSol === "number")
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (!latestPrice || typeof latestPrice.marketCapSol !== "number") return undefined;

  const marketCapUSD = latestPrice.marketCapSol * solPriceUSD;
  return {
    usdMarketCap: Number(marketCapUSD.toFixed(2)),
    solMarketCap: latestPrice.price * BILLION,
    solPrice: latestPrice.price,
    usdPrice: latestPrice.price * solPriceUSD
  };
}

type Currency = "SOL" | "USD"

export default function Dashboard() {
  const { userData, loading } = useAuth();
  const [mintToTokenData, setMintToTokenData] = useState<Map<string, Token | undefined>>(new Map());
  const [solPrice, setSolPrice] = useState<CryptoDataDb | undefined>(cache.solPrice.data);
  const [currency, setCurrency] = useState<Currency>("USD"); // Default to USD
  const [selectedMetric, setSelectedMetric] = useState<"totalEquity" | "marketCap" | "price">("totalEquity"); // Default to totalEquity

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
            ...(userData?.trackedTokens?.map((token) => token.mint) || []),
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

  // Handle currency toggle
  function handleCurrencyToggle(newCurrency: Currency){
    setCurrency(newCurrency);
  };

    // Handle metric selection
    const handleMetricChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedMetric(event.target.value as "totalEquity" | "marketCap" | "price");
    };

  return (
    <div className={styles.container}>

      <section className={styles.assetsSection}>
        <h1 className={styles.sectionTitle}>Your Tracked Assets</h1>
              {/* Currency Toggle */}
              <div className={styles.currencySelectRow}>

              
              <div className={styles.currencyToggle}>
                <div
                  className={styles.toggleIndicator}
                  style={{
                    left: currency === "USD" ? "4px" : "calc(50% + 2px)"
                  }}
                />
                <button
                  className={`${styles.toggleButton} ${currency === "USD" ? styles.toggleActive : ""}`}
                  onClick={() => handleCurrencyToggle("USD")}
                  aria-label="Switch to USD"
                >
                  USD
                </button>
                <button
                  className={`${styles.toggleButton} ${currency === "SOL" ? styles.toggleActive : ""}`}
                  onClick={() => handleCurrencyToggle("SOL")}
                  aria-label="Switch to SOL"
                >
                  SOL
                </button>
              </div>


        {/* Metric Selection Dropdown */}
        <div className={styles.metricSelect}>
          <div className={styles.selectWrapper}>
            <select
              value={selectedMetric}
              onChange={handleMetricChange}
              className={styles.metricDropdown}
              aria-label="Select metric to display"
            >
              <option value="totalEquity">Total Equity</option>
              <option value="marketCap">Market Cap</option>
              <option value="price">Latest Price</option>
            </select>
            <FaChevronDown className={styles.selectIcon} aria-hidden="true" />
          </div>
        </div>
        </div>

        <div className={styles.tokenList}>
          {(userData?.trackedTokens?.length || 0) > 0 ? (
            userData?.trackedTokens?.map((token: TrackedToken, index: number) => {
              const tokenFromDb = mintToTokenData.get(token.mint);
              const imageSrc = tokenFromDb?.tokenData?.tokenMetadata?.image || "/placeholder.jpg";
              const latestPriceData: TokenPriceData | undefined = getMarketCapUSDFromPrices(
                tokenFromDb?.prices || [],
                solPrice?.priceUsd || 0
              );

              // Handle notification button click
              const handleNotificationToggle = async () => {
                try {
                  const userRef = doc(db, "users", userData?.uid);
                  const updatedTokens = userData?.trackedTokens?.map((t: TrackedToken) =>
                    t.mint === token.mint ? { ...t, isNotificationsOn: !t.isNotificationsOn } : t
                  );
                  await updateDoc(userRef, { trackedTokens: updatedTokens });
                  // Note: You may need to update local state to reflect the change immediately
                } catch (error) {
                  console.error(`Error updating notifications for token ${token.mint}:`, error);
                }
              };

              return (
                <div key={index} className={styles.tokenRowWrapper}>
                  <div className={styles.tokenRow}>
                    <div className={styles.tokenInfo}>
                      <button
                        onClick={handleNotificationToggle}
                        className={`${styles.notificationButton} ${
                          token.isNotificationsOn ? styles.notificationOn : styles.notificationOff
                        }`}
                        aria-label={`Turn ${token.isNotificationsOn ? "off" : "on"} notifications for ${
                          tokenFromDb?.tokenData?.tokenMetadata?.symbol || token.mint
                        }`}
                      >
                        { token.isNotificationsOn ? <CiBellOn/> : <CiBellOff/>}
                      </button>
                      <Image
                        src={imageSrc}
                        alt={`${tokenFromDb?.tokenData?.tokenMetadata?.symbol || token.mint} logo`}
                        width={50}
                        height={50}
                        className={styles.tokenImage}
                      />
                      <div>
                        <p className={styles.tokenSymbol}>
                          {tokenFromDb?.tokenData?.tokenMetadata?.symbol || token.mint}
                        </p>
                        <p className={styles.tokenLabel}>Tokens Owned: {formatNumber(token.tokensOwned)}</p>
                      </div>
                    </div>
                    <div className={styles.tokenDetails}>
                      {latestPriceData ? (
                        <TokenMetricDisplay
                          trackedToken={token}
                          currency={currency}
                          solPrice={solPrice?.priceUsd || 0}
                          priceData={latestPriceData}
                          selectedMetric={selectedMetric}
                        />
                      ) : (
                        <p className={styles.emptyState}>Price data unavailable</p>
                      )}
                    </div>
                  </div>
                  {index < (userData?.trackedTokens?.length || 0) - 1 && <hr className={styles.tokenSeparator} />}
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
              const tokenMint = notification.id.split("_")[0];
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
                      <p className={styles.notificationHeader}>
                        {notification?.notificationTitle || `${metadata.symbol} (${shortenString(tokenMint)})`}
                      </p>
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