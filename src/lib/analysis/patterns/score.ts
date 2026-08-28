import type { Candle } from "@/lib/market-data/types";
import { nearestZones } from "../support-resistance";
import type { TimeframeStructureAnalysis } from "../types";
import type { PatternDetectionOptions, PatternDirection } from "./types";

export function scorePatternContext(direction: PatternDirection, candle: Candle, averageRange: number, structure: TimeframeStructureAnalysis, options: PatternDetectionOptions) {
  const zones = nearestZones(structure.zones.filter((zone) => zone.touches >= 2), candle.close); const relevant = direction === "bullish" ? zones.support : direction === "bearish" ? zones.resistance : undefined;
  const distance = relevant ? Math.max(0, relevant.low - candle.high, candle.low - relevant.high) : Infinity; const nearLevel = distance <= averageRange * 1.25;
  const locationScore = direction === "neutral" ? 50 : nearLevel ? Math.min(98, 82 + (relevant?.strength ?? 0) * .16) : 42;
  const major = options.majorTrend ?? structure.trend.trend; const local = structure.trend.trend; const alignsMajor = direction !== "neutral" && major === direction; const againstMajorTrend = direction !== "neutral" && major !== "sideways" && major !== direction; const alignsLocal = direction !== "neutral" && local === direction;
  const trendAlignmentScore = direction === "neutral" ? 50 : alignsMajor && alignsLocal ? 94 : alignsMajor ? 82 : againstMajorTrend ? 28 : alignsLocal ? 70 : 52;
  const context = direction === "neutral" ? "Indecision" : nearLevel ? `Near ${direction === "bullish" ? "support" : "resistance"}` : againstMajorTrend ? "Against major trend" : "Mid-range";
  return { locationScore, trendAlignmentScore, againstMajorTrend, context, contextReasons: [nearLevel ? `Pattern formed near confirmed ${relevant?.type}` : "Pattern formed away from a confirmed zone", againstMajorTrend ? "Pattern is against the major trend" : alignsMajor ? "Pattern aligns with the major trend" : "Major trend is not directional"] };
}
