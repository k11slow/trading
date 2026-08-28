import { isMemeAsset } from "@/lib/instruments/meme-classifier";
import type { MarketRanking, TrendingInstrument } from "./types";
type Ticker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  weightedAvgPrice: string;
  count: number;
};
const configuredRestUrl = process.env.BINANCE_REST_URL?.replace(/\/$/, "");
const REST = !configuredRestUrl || configuredRestUrl === "https://api.binance.com"
  ? "https://data-api.binance.vision"
  : configuredRestUrl;
let tickerCache: { expiresAt: number; rows: Ticker[] } | null = null;
const nameFor = (symbol: string) => `${symbol.replace(/USDT$/, "")} / Tether`;
const normalize = (value: number, min: number, max: number) =>
  max === min ? 0 : (value - min) / (max - min);
export async function getBinanceTrending(
  market: "Crypto" | "Meme Coins",
  ranking: MarketRanking,
  limit = 25,
): Promise<TrendingInstrument[]> {
  let rows =
    process.env.NODE_ENV !== "test" &&
    tickerCache &&
    tickerCache.expiresAt > Date.now()
      ? tickerCache.rows
      : null;
  if (!rows) {
    const response = await fetch(`${REST}/api/v3/ticker/24hr`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Binance returned HTTP ${response.status}`);
    rows = (await response.json()) as Ticker[];
    if (process.env.NODE_ENV !== "test")
      tickerCache = { expiresAt: Date.now() + 10_000, rows };
  }
  const candidates = rows
    .filter(
      (row) =>
        row.symbol.endsWith("USDT") &&
        !/UPUSDT$|DOWNUSDT$|BULLUSDT$|BEARUSDT$/.test(row.symbol) &&
        (market === "Meme Coins"
          ? isMemeAsset(row.symbol.replace(/USDT$/, ""))
          : !isMemeAsset(row.symbol.replace(/USDT$/, ""))),
    )
    .map((row) => {
      const price = Number(row.lastPrice);
      const change = Number(row.priceChangePercent);
      const volume = Number(row.quoteVolume);
      const average = Number(row.weightedAvgPrice);
      const volatility =
        average > 0
          ? ((Number(row.highPrice) - Number(row.lowPrice)) / average) * 100
          : 0;
      return {
        row,
        price,
        change,
        volume,
        volatility,
        trades: Number(row.count),
      };
    })
    .filter(
      (item) =>
        [
          item.price,
          item.change,
          item.volume,
          item.volatility,
          item.trades,
        ].every(Number.isFinite) && item.price > 0,
    );
  const logs = candidates.map((item) => Math.log10(item.volume + 1));
  const trades = candidates.map((item) => Math.log10(item.trades + 1));
  const moves = candidates.map((item) => Math.abs(item.change));
  const volatilities = candidates.map((item) => item.volatility);
  const range = (values: number[]) =>
    [Math.min(...values), Math.max(...values)] as const;
  const [vMin, vMax] = range(logs);
  const [tMin, tMax] = range(trades);
  const [mMin, mMax] = range(moves);
  const [xMin, xMax] = range(volatilities);
  const result = candidates.map((item): TrendingInstrument => ({
    symbol: item.row.symbol.replace(/USDT$/, "/USDT"),
    name: nameFor(item.row.symbol),
    market,
    price: item.price,
    changePercent: item.change,
    volume: item.volume,
    volumeChange: null,
    volatility: item.volatility,
    tradeCount: item.trades,
    trendingScore: Math.round(
      100 *
        (0.4 * normalize(Math.log10(item.volume + 1), vMin, vMax) +
          0.25 * normalize(Math.log10(item.trades + 1), tMin, tMax) +
          0.15 * normalize(Math.abs(item.change), mMin, mMax) +
          0.2 * normalize(item.volatility, xMin, xMax)),
    ),
    aiSetupScore: null,
    trendDirection:
      item.change > 0.15
        ? "Bullish"
        : item.change < -0.15
          ? "Bearish"
          : "Sideways",
    newsActivity: null,
    source: "LIVE",
    provider: "Binance",
    highRisk: market === "Meme Coins",
  }));
  return result
    .sort((a, b) =>
      ranking === "Top Gainers"
        ? b.changePercent - a.changePercent
        : ranking === "Top Losers"
          ? a.changePercent - b.changePercent
          : ranking === "Most Active"
            ? b.volume - a.volume
            : b.trendingScore - a.trendingScore,
    )
    .slice(0, limit);
}
