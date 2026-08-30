import type { MarketCategory, Timeframe } from "@/lib/market-data/types";
import type { MarketSession, PatternDirection, PatternName } from "@/lib/analysis";

export type BacktestConfig = {
  symbol: string; category: MarketCategory; timeframe: Timeframe; minimumConfidence: number;
  stopAtr: number; targetAtr: number; maximumHoldCandles: number; feesBps: number; slippageBps: number;
};
export type BacktestSignal = { candleIndex: number; pattern: PatternName; direction: Exclude<PatternDirection, "neutral">; confidence: number; session: MarketSession };
export type BacktestTrade = {
  pattern: PatternName; direction: "bullish" | "bearish"; session: MarketSession; confidence: number;
  signalTime: number; entryTime: number; exitTime: number; entry: number; stop: number; target: number; exit: number;
  result: "WIN" | "LOSS" | "TIME_EXIT"; grossR: number; netR: number; heldCandles: number;
};
export type BacktestBreakdown = { name: string; trades: number; wins: number; winRate: number; expectancyR: number; netR: number };
export type BacktestResult = {
  config: BacktestConfig; generatedAt: number; candles: number; signals: number; trades: BacktestTrade[];
  metrics: { trades: number; wins: number; losses: number; timeExits: number; winRate: number; profitFactor: number | null; expectancyR: number; netR: number; maximumDrawdownR: number };
  byPattern: BacktestBreakdown[]; bySession: BacktestBreakdown[];
  warning: string | null;
};
