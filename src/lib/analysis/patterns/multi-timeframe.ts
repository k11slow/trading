import type { Candle, Timeframe } from "@/lib/market-data/types";
import type { MultiTimeframeStructureAnalysis } from "../types";
import { detectCandlestickPatterns } from "./detect";
import type { MultiTimeframePatternAnalysis, PatternDetectionOptions } from "./types";

export function analyzeMultiTimeframePatterns(symbol: string, datasets: Partial<Record<Timeframe, Candle[]>>, structure: MultiTimeframeStructureAnalysis, options: PatternDetectionOptions = {}): MultiTimeframePatternAnalysis {
  const byTimeframe: MultiTimeframePatternAnalysis["byTimeframe"] = {}; const majorTrend = structure.byTimeframe["4H"]?.trend.trend ?? "sideways";
  for (const timeframe of ["4H", "1H", "15m"] as Timeframe[]) { const candles = datasets[timeframe]; const timeframeStructure = structure.byTimeframe[timeframe]; if (!candles?.length || !timeframeStructure) continue; const patterns = detectCandlestickPatterns(candles, timeframe, timeframeStructure, { ...options, majorTrend }); byTimeframe[timeframe] = { timeframe, patterns, mostRelevant: patterns[0] ?? null }; }
  return { symbol, generatedAt: Date.now(), byTimeframe, setupConditions: buildSetupConditions(structure, byTimeframe) };
}

function buildSetupConditions(structure: MultiTimeframeStructureAnalysis, patterns: MultiTimeframePatternAnalysis["byTimeframe"]) {
  const conditions: string[] = []; const h4 = structure.byTimeframe["4H"]; const h1 = structure.byTimeframe["1H"]; const m15 = patterns["15m"]?.mostRelevant;
  if (h4 && h1 && m15) conditions.push(`4H ${h4.trend.trend} trend + 1H ${h1.latestStructure} + 15M ${m15.name.toLowerCase()} ${m15.status}`);
  const reversal = h1?.roleReversals[0]; if (reversal && m15) conditions.push(`1H ${reversal.label.toLowerCase()} + 15M ${m15.name.toLowerCase()}`);
  if (m15?.reliability?.volumeConfirmed) conditions.push(`15M volume confirmation at ${m15.reliability.volumeRatio.toFixed(2)}× average during the ${m15.reliability.session} session`);
  if (m15?.reliability?.cluster.length) conditions.push(`Pattern cluster: ${[m15.name, ...m15.reliability.cluster].join(" + ")}`);
  if (m15?.reliability?.divergence) conditions.push(m15.reliability.divergence);
  if (m15?.reliability?.historicalWinRate !== null && m15?.reliability?.historicalWinRate !== undefined) conditions.push(`${m15.name} historical 3-candle follow-through: ${m15.reliability.historicalWinRate}% (${m15.reliability.historicalSamples} samples)`);
  return conditions;
}
