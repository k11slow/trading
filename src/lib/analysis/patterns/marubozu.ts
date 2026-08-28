import type { PatternDetectorContext, RawPattern } from "./types";

export function detectMarubozu({ metrics }: PatternDetectorContext): RawPattern[] {
  if (metrics.bodyRatio < .86 || metrics.upperWickRatio > .09 || metrics.lowerWickRatio > .09) return [];
  return [{ name: metrics.bullish ? "Bullish Marubozu" : "Bearish Marubozu", abbreviation: metrics.bullish ? "BM+" : "BM−", direction: metrics.bullish ? "bullish" : "bearish", shapeScore: Math.round(Math.min(97, 75 + metrics.bodyRatio * 22)), reasons: ["Body occupies nearly the entire candle range", "Minimal wicks show one-sided control"] }];
}
