import type { Candle, Timeframe } from "@/lib/market-data/types";
import type { TimeframeStructureAnalysis } from "../types";
import { detectEngulfing } from "./engulfing";
import { detectIndecision } from "./doji";
import { detectHammerFamily } from "./hammer";
import { detectInsideOutside } from "./inside-outside";
import { detectMarubozu } from "./marubozu";
import { detectMultiCandle } from "./multi-candle";
import { detectStarPatterns } from "./stars";
import { detectWickRejection } from "./wick-rejection";
import { detectReversalPatterns } from "./reversals";
import { detectMarketSignals } from "./market-signals";
import { enrichPatternReliability } from "./reliability";
import { candleMetrics, recentAverageRange } from "./metrics";
import { explanations } from "./explanations";
import { scorePatternContext } from "./score";
import type { PatternDetection, PatternDetectionOptions, PatternDetectorContext, PatternStatus, RawPattern } from "./types";

const sensitivitySettings = { low: { minimumScore: 66, minimumRange: .55 }, medium: { minimumScore: 52, minimumRange: .28 }, high: { minimumScore: 42, minimumRange: .12 } } as const;

function rawPatterns(context: PatternDetectorContext) {
  return [...detectEngulfing(context), ...detectHammerFamily(context), ...detectIndecision(context), ...detectStarPatterns(context), ...detectMarubozu(context), ...detectInsideOutside(context), ...detectMultiCandle(context), ...detectWickRejection(context), ...detectReversalPatterns(context), ...detectMarketSignals(context)].sort((a, b) => b.shapeScore - a.shapeScore);
}

function scoreRawPattern(raw: RawPattern, candles: Candle[], index: number, timeframe: Timeframe, structure: TimeframeStructureAnalysis, options: PatternDetectionOptions, status: PatternStatus): PatternDetection | null {
  const metrics = candleMetrics(candles[index]); const averageRange = recentAverageRange(candles, index); const setting = sensitivitySettings[options.sensitivity ?? "medium"];
  if (metrics.range < averageRange * setting.minimumRange) return null;
  const context = scorePatternContext(raw.direction, candles[index], averageRange, structure, options); let finalScore = raw.shapeScore * .55 + context.locationScore * .3 + context.trendAlignmentScore * .15;
  if (status === "forming") finalScore -= 12; const confidence = Math.round(Math.max(1, Math.min(99, finalScore)));
  if (confidence < setting.minimumScore) return null;
  return { id: `${timeframe}-${candles[index].time}-${raw.name.toLowerCase().replaceAll(" ", "-")}`, name: raw.name, abbreviation: raw.abbreviation, direction: raw.direction, timeframe, candleIndex: index, timestamp: candles[index].time, confidence, strength: confidence >= 78 ? "high" : confidence >= 60 ? "medium" : "low", status, reason: [...raw.reasons, ...context.contextReasons], explanation: explanations[raw.name], context: context.context, againstMajorTrend: context.againstMajorTrend, debug: { ...metrics, averageRange, shapeScore: raw.shapeScore, locationScore: context.locationScore, trendAlignmentScore: context.trendAlignmentScore, finalScore: confidence } };
}

export function detectCandlestickPatterns(candles: Candle[], timeframe: Timeframe, structure: TimeframeStructureAnalysis, options: PatternDetectionOptions = {}): PatternDetection[] {
  if (candles.length < 6) return [];
  const detections: PatternDetection[] = []; const confirmedEnd = candles.length - 2; const start = Math.max(4, confirmedEnd - (options.lookback ?? 120));
  const evaluate = (index: number, status: PatternStatus) => { const context: PatternDetectorContext = { candles, index, metrics: candleMetrics(candles[index]), structure, options }; for (const raw of rawPatterns(context)) { const scored = scoreRawPattern(raw, candles, index, timeframe, structure, options, status); if (scored) detections.push(scored); } };
  for (let index = start; index <= confirmedEnd; index++) evaluate(index, "confirmed");
  if (options.includeForming !== false) evaluate(candles.length - 1, "forming");
  const statuses = new Map<number, PatternStatus>();
  for (let index = start; index <= confirmedEnd; index++) statuses.set(index, "confirmed");
  if (options.includeForming !== false) statuses.set(candles.length - 1, "forming");
  return enrichPatternReliability(detections, candles, statuses).sort((a, b) => b.timestamp - a.timestamp || b.confidence - a.confidence);
}
