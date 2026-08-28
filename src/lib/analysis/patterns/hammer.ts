import type { PatternDetectorContext, RawPattern } from "./types";

export function detectHammerFamily({ metrics, structure }: PatternDetectorContext): RawPattern[] {
  if (metrics.bodyRatio < .12) return [];
  const results: RawPattern[] = [];
  if (metrics.lowerWick >= metrics.body * 2 && metrics.upperWick <= metrics.body * .65 && metrics.lowerWickRatio >= .55) {
    const bearishContext = structure.trend.trend === "bullish";
    results.push({ name: bearishContext ? "Hanging Man" : "Hammer", abbreviation: bearishContext ? "HM" : "H", direction: bearishContext ? "bearish" : "bullish", shapeScore: Math.min(94, 74 + metrics.lowerWickRatio * 20), reasons: ["Lower wick is at least twice the candle body", "Price recovered strongly from the session low"] });
  }
  if (metrics.upperWick >= metrics.body * 2 && metrics.lowerWick <= metrics.body * .65 && metrics.upperWickRatio >= .55) {
    const bearishContext = structure.trend.trend === "bullish";
    results.push({ name: bearishContext ? "Shooting Star" : "Inverted Hammer", abbreviation: bearishContext ? "SS" : "IH", direction: bearishContext ? "bearish" : "bullish", shapeScore: Math.min(94, 74 + metrics.upperWickRatio * 20), reasons: ["Upper wick is at least twice the candle body", "Price was strongly rejected from the session high"] });
  }
  return results;
}
