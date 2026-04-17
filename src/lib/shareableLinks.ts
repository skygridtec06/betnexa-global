import { BetSlipItem } from "@/components/BettingSlip";

/**
 * Encodes bet selections into a URL-safe string
 */
export const encodeSelections = (items: BetSlipItem[]): string => {
  if (!items || items.length === 0) return "";
  
  const encoded = items.map(item => ({
    matchId: item.matchId,
    type: item.type,
    odds: item.odds,
    match: item.match,
    market: item.market,
  }));
  
  return btoa(JSON.stringify(encoded));
};

/**
 * Decodes bet selections from URL-safe string
 */
export const decodeSelections = (encoded: string): BetSlipItem[] => {
  if (!encoded) return [];
  
  try {
    const decoded = JSON.parse(atob(encoded));
    return Array.isArray(decoded) ? decoded : [];
  } catch (error) {
    console.error("Failed to decode selections:", error);
    return [];
  }
};

/**
 * Generates a shareable link with encoded selections
 */
export const generateShareableLink = (items: BetSlipItem[], baseUrl: string = window.location.origin): string => {
  const encoded = encodeSelections(items);
  if (!encoded) return "";
  
  return `${baseUrl}/?picks=${encoded}`;
};

/**
 * Gets picks from URL parameters
 */
export const getPicksFromUrl = (): BetSlipItem[] => {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("picks");
  
  if (!encoded) return [];
  
  return decodeSelections(encoded);
};

/**
 * Clears picks from URL
 */
export const clearPicksFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  params.delete("picks");
  
  const newUrl = params.toString() 
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  
  window.history.replaceState({}, "", newUrl);
};
