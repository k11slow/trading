import type { ProviderCapability } from "./types";
export const providerCapabilities: ProviderCapability[] = [
  { provider: "Binance", markets: ["Crypto", "Meme Coins"], symbols: true, quotes: true, batchQuotes: true, candles: true, volume: true, stats24h: true, search: true },
  { provider: "Twelve Data", markets: ["Forex", "Stocks", "Indices", "ETFs", "Commodities"], symbols: true, quotes: true, batchQuotes: true, candles: true, volume: true, stats24h: false, search: true },
  { provider: "Finnhub", markets: ["Stocks", "ETFs"], symbols: true, quotes: true, batchQuotes: false, candles: false, volume: false, stats24h: false, search: true },
  { provider: "DEX Screener", markets: ["Crypto", "Meme Coins"], symbols: true, quotes: true, batchQuotes: true, candles: false, volume: true, stats24h: true, search: true },
  { provider: "GeckoTerminal", markets: ["Crypto", "Meme Coins"], symbols: true, quotes: true, batchQuotes: true, candles: true, volume: true, stats24h: true, search: true },
  { provider: "Massive Futures", markets: ["Futures"], symbols: true, quotes: true, batchQuotes: false, candles: true, volume: true, stats24h: true, search: true },
];
export const capabilitiesFor = (provider: string) => providerCapabilities.find((entry) => entry.provider === provider);
