import { candleMetrics } from "./metrics";
import type { PatternDetectorContext, RawPattern } from "./types";

export function detectEngulfing({ candles, index, metrics }: PatternDetectorContext): RawPattern[] {
  if (index < 1) return []; const current = candles[index]; const previous = candles[index - 1]; const prior = candleMetrics(previous); const tolerance = previous.high - previous.low > 0 ? (previous.high - previous.low) * .04 : 0;
  if (metrics.bullish && prior.bearish && current.open <= previous.close + tolerance && current.close >= previous.open - tolerance && metrics.body > prior.body * .95) return [{ name: "Bullish Engulfing", abbreviation: "BE", direction: "bullish", shapeScore: Math.min(96, 75 + (metrics.body / Math.max(prior.body, Number.EPSILON) - 1) * 15), reasons: ["Green body engulfed the previous red body", "Current body matched or exceeded the previous body"] }];
  if (metrics.bearish && prior.bullish && current.open >= previous.close - tolerance && current.close <= previous.open + tolerance && metrics.body > prior.body * .95) return [{ name: "Bearish Engulfing", abbreviation: "BE", direction: "bearish", shapeScore: Math.min(96, 75 + (metrics.body / Math.max(prior.body, Number.EPSILON) - 1) * 15), reasons: ["Red body engulfed the previous green body", "Current body matched or exceeded the previous body"] }];
  return [];
}
