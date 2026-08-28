import type { StructureLabel, TrendAnalysis } from "./types";

export function classifyTrend(labels: StructureLabel[], lookback = 8): TrendAnalysis {
  const recent = labels.slice(-lookback); const bullishSignals = recent.filter((item) => item.label === "HH" || item.label === "HL").length; const bearishSignals = recent.filter((item) => item.label === "LH" || item.label === "LL").length; const total = bullishSignals + bearishSignals;
  if (total < 3) return { trend: "sideways", confidence: Math.min(45, total * 15), bullishSignals, bearishSignals };
  const dominance = Math.abs(bullishSignals - bearishSignals) / total; const hasBullPair = recent.some((item) => item.label === "HH") && recent.some((item) => item.label === "HL"); const hasBearPair = recent.some((item) => item.label === "LH") && recent.some((item) => item.label === "LL");
  if (bullishSignals / total >= .625 && hasBullPair) return { trend: "bullish", confidence: Math.round(Math.min(96, 55 + dominance * 41)), bullishSignals, bearishSignals };
  if (bearishSignals / total >= .625 && hasBearPair) return { trend: "bearish", confidence: Math.round(Math.min(96, 55 + dominance * 41)), bullishSignals, bearishSignals };
  return { trend: "sideways", confidence: Math.round(Math.min(90, 55 + (1 - dominance) * 35)), bullishSignals, bearishSignals };
}
