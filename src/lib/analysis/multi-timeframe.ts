import type { Candle, Timeframe } from "@/lib/market-data/types";
import { classifyStructure, describeLatestStructure } from "./structure";
import { detectSwings } from "./swings";
import { buildSupportResistanceZones, detectRoleReversals } from "./support-resistance";
import { classifyTrend } from "./trend";
import type { AnalysisOptions, MultiTimeframeStructureAnalysis, TimeframeStructureAnalysis } from "./types";

export function analyzeTimeframe(candles: Candle[], timeframe: Timeframe, options: AnalysisOptions = {}): TimeframeStructureAnalysis {
  const confirmedCandles = candles.length > 1 ? candles.slice(0, -1) : [];
  const swings = detectSwings(confirmedCandles, options.sensitivity ?? "medium"); const labels = classifyStructure(swings); const trend = classifyTrend(labels); const zones = buildSupportResistanceZones(confirmedCandles, swings, timeframe, options.maxZonesPerType ?? 4); const roleReversals = detectRoleReversals(confirmedCandles, zones.filter((zone) => zone.touches >= 2), options.breakoutTolerance ?? .0008);
  return { timeframe, swings, labels, trend, zones, roleReversals, latestStructure: describeLatestStructure(labels), analyzedThrough: confirmedCandles.at(-1)?.time ?? null };
}

export function analyzeMultipleTimeframes(symbol: string, datasets: Partial<Record<Timeframe, Candle[]>>, options: AnalysisOptions = {}): MultiTimeframeStructureAnalysis {
  const byTimeframe: MultiTimeframeStructureAnalysis["byTimeframe"] = {};
  for (const timeframe of Object.keys(datasets) as Timeframe[]) { const candles = datasets[timeframe]; if (candles?.length) byTimeframe[timeframe] = analyzeTimeframe(candles, timeframe, options); }
  return { symbol, generatedAt: Date.now(), byTimeframe };
}

const analysisCache = new Map<string, { confirmedTime: number | undefined; value: TimeframeStructureAnalysis }>();
export function memoizedTimeframeAnalysis(cacheKey: string, candles: Candle[], timeframe: Timeframe, options: AnalysisOptions = {}) {
  const confirmedTime = candles.at(-2)?.time; const key = `${cacheKey}:${timeframe}:${options.sensitivity ?? "medium"}`; const cached = analysisCache.get(key);
  if (cached && cached.confirmedTime === confirmedTime) return cached.value;
  const value = analyzeTimeframe(candles, timeframe, options); analysisCache.set(key, { confirmedTime, value });
  if (analysisCache.size > 100) analysisCache.delete(analysisCache.keys().next().value!);
  return value;
}
