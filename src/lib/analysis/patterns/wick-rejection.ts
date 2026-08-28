import type { PatternDetectorContext, RawPattern } from "./types";

export function detectWickRejection({ metrics }: PatternDetectorContext): RawPattern[] {
  const results: RawPattern[] = [];
  if (metrics.lowerWickRatio >= .58 && metrics.upperWickRatio <= .2) results.push({ name: "Long Lower Wick", abbreviation: "LLW", direction: "bullish", shapeScore: Math.round(65 + metrics.lowerWickRatio * 25), reasons: ["Long lower wick shows rejection of lower prices", "Price closed well above the candle low"] });
  if (metrics.upperWickRatio >= .58 && metrics.lowerWickRatio <= .2) results.push({ name: "Long Upper Wick", abbreviation: "LUW", direction: "bearish", shapeScore: Math.round(65 + metrics.upperWickRatio * 25), reasons: ["Long upper wick shows rejection of higher prices", "Price closed well below the candle high"] });
  return results;
}
