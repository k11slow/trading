import { candleMetrics } from "./metrics";
import type { PatternDetectorContext, RawPattern } from "./types";

export function detectStarPatterns({ candles, index, metrics }: PatternDetectorContext): RawPattern[] {
  if (index < 2) return []; const first = candleMetrics(candles[index - 2]); const middle = candleMetrics(candles[index - 1]); const firstMidpoint = (candles[index - 2].open + candles[index - 2].close) / 2;
  if (first.bearish && first.bodyRatio >= .5 && middle.bodyRatio <= .35 && metrics.bullish && metrics.bodyRatio >= .45 && candles[index].close > firstMidpoint) return [{ name: "Morning Star", abbreviation: "MS", direction: "bullish", shapeScore: 86, reasons: ["Strong bearish candle was followed by indecision", "The third candle recovered beyond the first body midpoint"] }];
  if (first.bullish && first.bodyRatio >= .5 && middle.bodyRatio <= .35 && metrics.bearish && metrics.bodyRatio >= .45 && candles[index].close < firstMidpoint) return [{ name: "Evening Star", abbreviation: "ES", direction: "bearish", shapeScore: 86, reasons: ["Strong bullish candle was followed by indecision", "The third candle fell beyond the first body midpoint"] }];
  return [];
}
