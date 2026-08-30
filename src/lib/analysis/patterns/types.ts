import type { Candle, Timeframe } from "@/lib/market-data/types";
import type { TimeframeStructureAnalysis, TrendDirection } from "../types";

export type PatternDirection = "bullish" | "bearish" | "neutral";
export type PatternStatus = "confirmed" | "forming";
export type PatternStrength = "low" | "medium" | "high";
export type PatternSensitivity = "low" | "medium" | "high";
export type PatternName = "Bullish Engulfing" | "Bearish Engulfing" | "Hammer" | "Inverted Hammer" | "Morning Star" | "Three White Soldiers" | "Bullish Marubozu" | "Shooting Star" | "Hanging Man" | "Evening Star" | "Three Black Crows" | "Bearish Marubozu" | "Doji" | "Spinning Top" | "Long-Legged Doji" | "Dragonfly Doji" | "Gravestone Doji" | "Inside Bar" | "Outside Bar" | "Rising Three Methods" | "Falling Three Methods" | "Long Lower Wick" | "Long Upper Wick" | "Bullish Pin Bar" | "Bearish Pin Bar" | "Piercing Line" | "Dark Cloud Cover" | "Bullish Harami" | "Bearish Harami" | "Tweezer Bottom" | "Tweezer Top" | "Three Inside Up" | "Three Inside Down" | "Abandoned Baby Bullish" | "Abandoned Baby Bearish" | "Bullish Liquidity Sweep" | "Bearish Liquidity Sweep" | "Bullish False Breakout" | "Bearish False Breakout";
export type CandleMetrics = { range: number; body: number; upperWick: number; lowerWick: number; bodyRatio: number; upperWickRatio: number; lowerWickRatio: number; bullish: boolean; bearish: boolean };
export type RawPattern = { name: PatternName; abbreviation: string; direction: PatternDirection; shapeScore: number; reasons: string[] };
export type PatternDebug = CandleMetrics & { averageRange: number; shapeScore: number; locationScore: number; trendAlignmentScore: number; finalScore: number };
export type MarketSession = "Asian" | "London" | "New York" | "Off-hours";
export type PatternReliability = {
  closedCandle: boolean; volumeRatio: number; volumeConfirmed: boolean; atrRatio: number;
  locationConfirmed: boolean; trendAligned: boolean; session: MarketSession;
  cluster: PatternName[]; divergence: string | null; historicalSamples: number; historicalWinRate: number | null;
};
export type PatternDetection = {
  id: string; name: PatternName; abbreviation: string; direction: PatternDirection; timeframe: Timeframe;
  candleIndex: number; timestamp: number; confidence: number; strength: PatternStrength; status: PatternStatus;
  reason: string[]; explanation: string; context: string; againstMajorTrend: boolean; debug: PatternDebug; reliability?: PatternReliability;
};
export type PatternDetectionOptions = { sensitivity?: PatternSensitivity; includeForming?: boolean; majorTrend?: TrendDirection; lookback?: number };
export type PatternDetectorContext = { candles: Candle[]; index: number; metrics: CandleMetrics; structure: TimeframeStructureAnalysis; options: PatternDetectionOptions };
export type TimeframePatternAnalysis = { timeframe: Timeframe; patterns: PatternDetection[]; mostRelevant: PatternDetection | null };
export type MultiTimeframePatternAnalysis = { symbol: string; generatedAt: number; byTimeframe: Partial<Record<Timeframe, TimeframePatternAnalysis>>; setupConditions: string[] };
