import { findAsset, marketCatalog } from "../market-data";
import { BinanceProvider } from "./providers/binance";
import { forexProvider } from "./providers/forex";
import { futuresProvider } from "./providers/futures";
import { stocksProvider } from "./providers/stocks";
import { dexMarketDataProvider } from "./providers/dex";
import { MarketDataError, marketCategories, type MarketCategory, type MarketDataProvider, type Timeframe } from "./types";

const binance = new BinanceProvider();
const timeframes: Timeframe[] = ["15m", "1H", "4H", "1D"];

export function parseCategory(value: string | null): MarketCategory {
  if (!value || !marketCategories.includes(value as MarketCategory)) throw new MarketDataError("Invalid market category", 400, "INVALID_CATEGORY");
  return value as MarketCategory;
}
export function parseTimeframe(value: string | null): Timeframe {
  if (!value || !timeframes.includes(value as Timeframe)) throw new MarketDataError("Invalid timeframe", 400, "INVALID_TIMEFRAME");
  return value as Timeframe;
}
export function resolveSymbol(value: string | null, category: MarketCategory) {
  if (!value || value.length > 64) throw new MarketDataError("Invalid symbol", 400, "INVALID_SYMBOL");
  const asset = findAsset(value.toUpperCase());
  if (asset.symbol.toUpperCase() !== value.toUpperCase() || asset.category !== category) { const normalized = value.toUpperCase(); if ((category === "Crypto" || category === "Meme Coins") && /^[A-Z0-9._-]{1,32}\/[A-Z0-9._-]{1,32}$/.test(normalized)) return { symbol: normalized, name: normalized.replace("/", " / "), exchange: "CRYPTO", category, price: 1, change: 0, decimals: 8, volatility: .03 }; if (category === "Forex" && /^[A-Z]{3}\/[A-Z]{3}$/.test(normalized)) return { symbol: normalized, name: normalized.replace("/", " / "), exchange: "TWELVE DATA", category, price: 1, change: 0, decimals: normalized.endsWith("JPY") ? 3 : 5, volatility: .0015 }; if (category === "Futures" && /^[A-Z0-9]{2,16}$/.test(normalized)) return { symbol: normalized, name: `${normalized} Futures Contract`, exchange: "CME", category, price: 1, change: 0, decimals: 4, volatility: .015 }; throw new MarketDataError("Symbol is not supported in this category", 404, "SYMBOL_UNAVAILABLE"); }
  return asset;
}
export function providerFor(category: MarketCategory, symbol?: { chainId?: string; pairAddress?: string }): MarketDataProvider {
  if ((category === "Crypto" || category === "Meme Coins") && symbol?.chainId && symbol.pairAddress) return dexMarketDataProvider;
  if (category === "Crypto" || category === "Meme Coins") return binance;
  if (category === "Stocks") return stocksProvider;
  if (category === "Forex") return forexProvider;
  return futuresProvider;
}
export function searchableCategory(category: MarketCategory) { return marketCatalog[category]; }
