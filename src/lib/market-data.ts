import type { CandlestickData, HistogramData, UTCTimestamp } from "lightweight-charts";
import type { MarketCategory, MarketSymbol, Timeframe } from "./market-data/types";
export { marketCategories } from "./market-data/types";
export type { MarketCategory, MarketSymbol, Timeframe } from "./market-data/types";

export type IndicatorKey = "ema20" | "ema50" | "volume" | "levels" | "structure" | "swings" | "trend" | "patterns";
export type Candle = { time: UTCTimestamp; open: number; high: number; low: number; close: number; volume: number };
export type SupportResistanceLevel = { type: "support" | "resistance"; price: number; label: "Support" | "Resistance" };
export type MarketStructurePoint = { time: UTCTimestamp; price: number; label: "HH" | "HL" | "LH" | "LL"; position: "aboveBar" | "belowBar" };
export type MarketAnalysis = {
  preference: "BUY" | "WAIT" | "SELL"; score: number; trend4H: "Bullish" | "Bearish" | "Sideways";
  structure: string; setup1H: string; confirmation15M: string; levels: SupportResistanceLevel[];
  riskReward: string; newsRisk: "Low" | "Medium" | "High"; reasons: string[];
};

export type MarketAsset = MarketSymbol;

export const marketCatalog: Record<MarketCategory, MarketAsset[]> = {
  Forex: [
    { symbol: "XAU/USD", name: "Gold Spot / U.S. Dollar", exchange: "TWELVE DATA", category: "Forex", price: 3414.2, change: .41, decimals: 2, volatility: .008 },
    { symbol: "EUR/USD", name: "Euro / U.S. Dollar", exchange: "FXCM", category: "Forex", price: 1.1663, change: .15, decimals: 5, volatility: .0012 },
    { symbol: "GBP/USD", name: "British Pound / U.S. Dollar", exchange: "OANDA", category: "Forex", price: 1.3548, change: -.08, decimals: 5, volatility: .0015 },
    { symbol: "USD/JPY", name: "U.S. Dollar / Japanese Yen", exchange: "FXCM", category: "Forex", price: 146.82, change: .24, decimals: 3, volatility: .0013 },
    { symbol: "USD/CHF", name: "U.S. Dollar / Swiss Franc", exchange: "TWELVE DATA", category: "Forex", price: .804, change: 0, decimals: 5, volatility: .0013 },
    { symbol: "AUD/USD", name: "Australian Dollar / U.S. Dollar", exchange: "TWELVE DATA", category: "Forex", price: .653, change: 0, decimals: 5, volatility: .0014 },
    { symbol: "USD/CAD", name: "U.S. Dollar / Canadian Dollar", exchange: "TWELVE DATA", category: "Forex", price: 1.384, change: 0, decimals: 5, volatility: .0013 },
    { symbol: "NZD/USD", name: "New Zealand Dollar / U.S. Dollar", exchange: "TWELVE DATA", category: "Forex", price: .592, change: 0, decimals: 5, volatility: .0015 },
    { symbol: "EUR/GBP", name: "Euro / British Pound", exchange: "TWELVE DATA", category: "Forex", price: .861, change: 0, decimals: 5, volatility: .0012 },
    { symbol: "EUR/JPY", name: "Euro / Japanese Yen", exchange: "TWELVE DATA", category: "Forex", price: 171.2, change: 0, decimals: 3, volatility: .0015 },
    { symbol: "GBP/JPY", name: "British Pound / Japanese Yen", exchange: "TWELVE DATA", category: "Forex", price: 198.4, change: 0, decimals: 3, volatility: .0018 },
  ],
  Stocks: [
    { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", category: "Stocks", price: 228.91, change: .62, decimals: 2, volatility: .012 },
    { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", category: "Stocks", price: 347.16, change: -1.12, decimals: 2, volatility: .024 },
    { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", category: "Stocks", price: 181.44, change: 1.84, decimals: 2, volatility: .019 },
    { symbol: "HOOD", name: "Robinhood Markets", exchange: "NASDAQ", category: "Stocks", price: 111.08, change: .37, decimals: 2, volatility: .026 },
  ],
  Futures: [
    { symbol: "GOLD", name: "Gold Futures", exchange: "COMEX", category: "Futures", price: 3414.2, change: .41, decimals: 2, volatility: .008 },
    { symbol: "SILVER", name: "Silver Futures", exchange: "COMEX", category: "Futures", price: 38.62, change: .73, decimals: 2, volatility: .012 },
    { symbol: "USOIL", name: "Crude Oil Futures", exchange: "NYMEX", category: "Futures", price: 64.73, change: -.66, decimals: 2, volatility: .014 },
    { symbol: "NASDAQ", name: "E-mini Nasdaq 100", exchange: "CME", category: "Futures", price: 23487.5, change: .28, decimals: 1, volatility: .009 },
  ],
  Crypto: [
    { symbol: "BTC/USDT", name: "Bitcoin / Tether", exchange: "BINANCE", category: "Crypto", price: 112840, change: 1.26, decimals: 0, volatility: .018 },
    { symbol: "ETH/USDT", name: "Ethereum / Tether", exchange: "BINANCE", category: "Crypto", price: 4613.8, change: 2.07, decimals: 1, volatility: .022 },
    { symbol: "SOL/USDT", name: "Solana / Tether", exchange: "BINANCE", category: "Crypto", price: 201.42, change: -.33, decimals: 2, volatility: .027 },
    { symbol: "XRP/USDT", name: "XRP / Tether", exchange: "BINANCE", category: "Crypto", price: .58, change: 0, decimals: 5, volatility: .025 },
    { symbol: "BNB/USDT", name: "BNB / Tether", exchange: "BINANCE", category: "Crypto", price: 610, change: 0, decimals: 2, volatility: .02 },
  ],
  "Meme Coins": [
    { symbol: "DOGE/USDT", name: "Dogecoin / Tether", exchange: "BINANCE", category: "Meme Coins", price: .2214, change: 3.21, decimals: 4, volatility: .041 },
    { symbol: "PEPE/USDT", name: "Pepe / Tether", exchange: "BYBIT", category: "Meme Coins", price: .00001, change: -2.14, decimals: 6, volatility: .052 },
    { symbol: "TRUMP/USDT", name: "Official Trump / Tether", exchange: "OKX", category: "Meme Coins", price: 8.41, change: .78, decimals: 2, volatility: .046 },
    { symbol: "SHIB/USDT", name: "Shiba Inu / Tether", exchange: "BINANCE", category: "Meme Coins", price: .000013, change: -1.03, decimals: 6, volatility: .038 },
    { symbol: "BONK/USDT", name: "Bonk / Tether", exchange: "BINANCE", category: "Meme Coins", price: .000018, change: 0, decimals: 8, volatility: .05 },
    { symbol: "FLOKI/USDT", name: "Floki / Tether", exchange: "BINANCE", category: "Meme Coins", price: .00009, change: 0, decimals: 8, volatility: .05 },
    { symbol: "WIF/USDT", name: "dogwifhat / Tether", exchange: "BINANCE", category: "Meme Coins", price: 1.4, change: 0, decimals: 3, volatility: .06 },
  ],
};

export const allAssets = Object.values(marketCatalog).flat();
export const canonicalSymbol = (symbol: string, category?: MarketCategory) => {
  const cleaned = symbol.trim().toUpperCase();
  return category === "Forex" && /^[A-Z]{6}$/.test(cleaned)
    ? `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`
    : cleaned;
};
export const normalizeMarketAsset = (asset: MarketAsset): MarketAsset => {
  const symbol = canonicalSymbol(asset.symbol, asset.category);
  const known = allAssets.find(
    (item) => item.category === asset.category && item.symbol === symbol,
  );
  if (known) return { ...asset, ...known, dataStatus: known.dataStatus };
  if (symbol !== asset.symbol)
    return { ...asset, symbol, dataStatus: undefined };
  return asset;
};
export const findAsset = (symbol: string) => {
  const cleaned = symbol.trim().toUpperCase();
  const normalized = /^[A-Z]{6}$/.test(cleaned)
    ? `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`
    : cleaned;
  return allAssets.find((asset) => asset.symbol === normalized) ?? marketCatalog.Forex[0];
};
export const pricePrecision = (asset: MarketAsset, value = asset.price) => asset.category === "Crypto" || asset.category === "Meme Coins" ? value >= 1_000 ? 2 : value >= 1 ? 3 : value >= .01 ? 5 : 8 : asset.decimals;
export const formatPrice = (asset: MarketAsset, value = asset.price) => { const decimals = pricePrecision(asset, value); return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); };

const analysisOverrides: Record<string, Partial<MarketAnalysis>> = {
  "EUR/USD": { preference: "WAIT", score: 64, trend4H: "Bullish", structure: "HH + HL", setup1H: "Near resistance", confirmation15M: "Not confirmed", riskReward: "1 : 1.4", newsRisk: "Low", levels: [{ type: "support", price: 1.1652, label: "Support" }, { type: "resistance", price: 1.167, label: "Resistance" }], reasons: ["4H trend is bullish", "Price is near 1H resistance", "15M confirmation is missing", "Current risk/reward is not attractive enough"] },
  "XAU/USD": { preference: "BUY", score: 78, trend4H: "Bullish", structure: "HH + HL", setup1H: "Pullback near support", confirmation15M: "Bullish rejection", riskReward: "1 : 2.3", newsRisk: "Medium", levels: [{ type: "support", price: 3388, label: "Support" }, { type: "resistance", price: 3442, label: "Resistance" }], reasons: ["Higher-timeframe structure remains bullish", "Price is reacting from established support", "15M rejection confirms buyer interest", "Projected reward justifies the current risk"] },
  "TRUMP/USDT": { preference: "WAIT", score: 48, trend4H: "Sideways", structure: "Mixed", setup1H: "High volatility", confirmation15M: "None", riskReward: "1 : 1.1", newsRisk: "High", levels: [{ type: "support", price: 8.08, label: "Support" }, { type: "resistance", price: 8.92, label: "Resistance" }], reasons: ["4H direction is unclear", "Price is moving inside a volatile range", "No lower-timeframe confirmation is present", "Headline risk is elevated"] },
};

export function getMarketAnalysis(asset: MarketAsset): MarketAnalysis {
  const bullish = asset.change >= 0;
  const base: MarketAnalysis = {
    preference: bullish ? "BUY" : "SELL", score: bullish ? 71 : 67, trend4H: bullish ? "Bullish" : "Bearish",
    structure: bullish ? "HH + HL" : "LH + LL", setup1H: bullish ? "Momentum continuation" : "Retest below resistance",
    confirmation15M: bullish ? "Bullish close" : "Bearish rejection",
    levels: [{ type: "support", price: asset.price * (1 - asset.volatility * 2.1), label: "Support" }, { type: "resistance", price: asset.price * (1 + asset.volatility * 2.1), label: "Resistance" }],
    riskReward: bullish ? "1 : 1.9" : "1 : 1.7", newsRisk: asset.category === "Meme Coins" ? "High" : asset.category === "Crypto" ? "Medium" : "Low",
    reasons: [bullish ? "Higher-timeframe momentum is positive" : "Higher-timeframe momentum is negative", "Price is reacting at a technical level", "Structure aligns across multiple timeframes", "Risk remains within the mock strategy threshold"],
  };
  return { ...base, ...analysisOverrides[asset.symbol] };
}

function hash(input: string) { return [...input].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 2654435761), 2166136261) >>> 0; }
function random(seed: number) { let state = seed; return () => { state = Math.imul(1664525, state) + 1013904223 >>> 0; return state / 4294967296; }; }

export function generateMarketData(asset: MarketAsset, timeframe: Timeframe) {
  const interval = { "15m": 900, "1H": 3600, "4H": 14400, "1D": 86400 }[timeframe];
  const rand = random(hash(`${asset.symbol}-${timeframe}`));
  const end = Math.floor(Date.UTC(2026, 7, 26, 12) / 1000 / interval) * interval;
  const candles: Candle[] = [];
  const volumes: HistogramData<UTCTimestamp>[] = [];
  let price = asset.price * (.94 + rand() * .04);
  for (let i = 0; i < 160; i++) {
    const open = price;
    const cycle = Math.sin(i * .22) * asset.volatility * .23;
    const move = (rand() - .47) * asset.volatility + cycle;
    const close = i === 159 ? asset.price : open * (1 + move);
    const wick = asset.volatility * (.15 + rand() * .38);
    const high = Math.max(open, close) * (1 + wick);
    const low = Math.min(open, close) * (1 - wick * (.75 + rand() * .5));
    const time = (end - (159 - i) * interval) as UTCTimestamp;
    const volume = Math.round(300 + rand() * 2700);
    candles.push({ time, open, high, low, close, volume });
    volumes.push({ time, value: volume, color: close >= open ? "#16c78442" : "#ea394342" });
    price = close;
  }
  return { candles, volumes };
}

export function calculateEma(data: CandlestickData<UTCTimestamp>[], period: number) {
  const multiplier = 2 / (period + 1); let value = data[0].close;
  return data.map((point) => { value = point.close * multiplier + value * (1 - multiplier); return { time: point.time, value }; });
}

export function generateStructurePoints(candles: Candle[], bullish: boolean): MarketStructurePoint[] {
  const indices = [42, 67, 94, 121, 146];
  return indices.map((index, order) => {
    const candle = candles[index]; const high = order % 2 === 0;
    const label = bullish ? (high ? "HH" : "HL") : (high ? "LH" : "LL");
    return { time: candle.time, price: high ? candle.high : candle.low, label, position: high ? "aboveBar" : "belowBar" };
  });
}
