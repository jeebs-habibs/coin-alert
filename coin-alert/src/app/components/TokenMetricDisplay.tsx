import React from "react";
import { TrackedToken } from "../../../../shared/types/user";
import { formatPriceWithSubscript } from "../../../../shared/utils/displayStringUtils";
import { TokenPriceData } from "../dashboard/page";
import styles from "./TokenMetricDisplay.module.css";

// Props interface
interface TokenMetricDisplayProps {
  trackedToken: TrackedToken;
  currency: "SOL" | "USD";
  solPrice: number; // USD price of 1 SOL for conversions
  priceData: TokenPriceData;
  selectedMetric: "totalEquity" | "marketCap" | "price"; // Metric set by parent
}


const TokenMetricDisplay: React.FC<TokenMetricDisplayProps> = ({
  trackedToken,
  currency,
  priceData,
  selectedMetric,
}) => {

  // Calculate and format the displayed metric
  const getMetricValue = () => {
    const tokensOwned = trackedToken.tokensOwned;

    switch (selectedMetric) {
      case "totalEquity":
        const price = currency === "USD" ? priceData.usdPrice : priceData.solPrice;
        return formatPriceWithSubscript(tokensOwned * price, currency);
      case "marketCap":
        const marketCap = currency === "USD" ? priceData.usdMarketCap : priceData.solMarketCap;
        return formatPriceWithSubscript(marketCap, currency);
      case "price":
        const priceValue = currency === "USD" ? priceData.usdPrice : priceData.solPrice;
        return formatPriceWithSubscript(priceValue, currency);
      default:
        return "N/A";
    }
  };


  return (
    <div className={styles.metricContainer}>
      <div className={styles.metricDisplay}>
        <span className={styles.metricValue}>{getMetricValue()}</span>
      </div>
    </div>
  );
};

export default TokenMetricDisplay;