


export function shortenString(input: string): string {
    if (input.length <= 6) {
      return input; // Return the original string if it's too short
    }
    return `${input.slice(0, 3)}...${input.slice(-3)}`;
  }
  
export function areStringListsEqual(list1: string[], list2: string[]): boolean {
    if (list1.length !== list2.length) return false;
  
    const sortedList1 = [...list1].sort();
    const sortedList2 = [...list2].sort();
  
    return sortedList1.every((value, index) => value === sortedList2[index]);
  }
  

export function formatNumber(num: number): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1_000_000_000) {
      return `${sign}${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (absNum >= 1_000_000) {
      return `${sign}${(num / 1_000_000).toFixed(1)}M`;
  }
  if (absNum >= 1_000) {
      return `${sign}${(num / 1_000).toFixed(1)}K`;
  }
  return `${sign}${num.toFixed(1)}`;
}

// Format a price with concise notation for large numbers and subscript for small numbers
export const formatPriceWithSubscript = (value: number, currency: "SOL" | "USD" = "USD"): string => {
  if (isNaN(value)) return "N/A";

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currency === "USD" ? "$" : "SOL ";

  // Handle large numbers (>= 1000)
  if (absValue >= 1000) {
    let formattedValue: string;
    let suffix: string;

    if (absValue >= 1_000_000_000) {
      // Billions (B)
      formattedValue = (absValue / 1_000_000_000).toFixed(1).replace(/\.0$/, ""); // e.g., 1.2, not 1.0
      suffix = "B";
    } else if (absValue >= 1_000_000) {
      // Millions (M)
      formattedValue = (absValue / 1_000_000).toFixed(1).replace(/\.0$/, "");
      suffix = "M";
    } else {
      // Thousands (k)
      formattedValue = (absValue / 1_000).toFixed(1).replace(/\.0$/, "");
      suffix = "k";
    }

    return `${sign}${symbol}${formattedValue}${suffix}`;
  }

  // Handle numbers between 1 and 1000
  if (absValue >= 1) {
    // Round to 2 decimals
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "SOL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Handle small numbers (< 1)
  // Convert to string to count leading zeros
  const strValue = absValue.toFixed(10).replace(/\.?0+$/, ""); // Remove trailing zeros
  const decimalIndex = strValue.indexOf(".");
  const digits = strValue.replace(".", "").replace(/^0+/, "");
  const leadingZeros = strValue.slice(decimalIndex + 1).match(/^0+/)?.[0]?.length || 0;

  if (leadingZeros < 2) {
    // Small numbers with few zeros: round to 4 decimals
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "SOL",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }

  // Subscript notation for many leading zeros (e.g., 0.00000363 -> 0.0₃363)
  const subscriptDigits = "₀₁₂₃₄₅₆₇₈₉";
  const subscriptZeroCount = leadingZeros
    .toString()
    .split("")
    .map((d) => subscriptDigits[Number(d)])
    .join("");
  const significantDigits = digits.slice(0, 3); // Show 3 significant digits

  return `${sign}${symbol}0.0${subscriptZeroCount}${significantDigits}`;
};