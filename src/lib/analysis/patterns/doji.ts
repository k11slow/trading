import type { PatternDetectorContext, RawPattern } from "./types";

export function detectIndecision({ metrics }: PatternDetectorContext): RawPattern[] {
  if (metrics.bodyRatio <= .1 && metrics.upperWickRatio >= .3 && metrics.lowerWickRatio >= .3) return [{ name: "Long-Legged Doji", abbreviation: "LD", direction: "neutral", shapeScore: 86, reasons: ["Open and close are nearly equal", "Long wicks show strong rejection in both directions"] }];
  if (metrics.bodyRatio <= .09) return [{ name: "Doji", abbreviation: "D", direction: "neutral", shapeScore: Math.round(92 - metrics.bodyRatio * 100), reasons: ["Open and close are very close", "Neither buyers nor sellers controlled the close"] }];
  if (metrics.bodyRatio <= .34 && metrics.upperWickRatio >= .2 && metrics.lowerWickRatio >= .2) return [{ name: "Spinning Top", abbreviation: "ST", direction: "neutral", shapeScore: 72, reasons: ["Small real body relative to the range", "Wicks on both sides show indecision"] }];
  return [];
}
