import type { Candle } from "@/lib/market-data/types";
import type { PatternDetection, PatternDirection, PatternName, PatternReliability, PatternStatus } from "./types";
import { recentAverageRange } from "./metrics";

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
function ema(values: number[], period: number) {
  const multiplier = 2 / (period + 1); let value = values[0] ?? 0;
  return values.map((next) => value = next * multiplier + value * (1 - multiplier));
}
function rsi(candles: Candle[], period = 14) {
  const output = Array(candles.length).fill(50) as number[];
  for (let index = period; index < candles.length; index++) {
    let gains = 0; let losses = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor++) { const change = candles[cursor].close - candles[cursor - 1].close; if (change >= 0) gains += change; else losses -= change; }
    output[index] = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
  }
  return output;
}
function divergenceAt(candles: Candle[], rsiValues: number[], macd: number[], index: number, direction: PatternDirection) {
  if (index < 26 || direction === "neutral") return null;
  const previous = index - 5;
  if (direction === "bullish" && candles[index].low < candles[previous].low) {
    if (rsiValues[index] > rsiValues[previous]) return "Bullish RSI divergence";
    if (macd[index] > macd[previous]) return "Bullish MACD divergence";
  }
  if (direction === "bearish" && candles[index].high > candles[previous].high) {
    if (rsiValues[index] < rsiValues[previous]) return "Bearish RSI divergence";
    if (macd[index] < macd[previous]) return "Bearish MACD divergence";
  }
  return null;
}
function marketSession(timestamp: number): PatternReliability["session"] {
  const hour = new Date(timestamp * 1_000).getUTCHours();
  if (hour >= 0 && hour < 7) return "Asian";
  if (hour >= 7 && hour < 13) return "London";
  if (hour >= 13 && hour < 21) return "New York";
  return "Off-hours";
}
function historicalOutcome(pattern: PatternDetection, candles: Candle[], horizon = 3) {
  const future = candles[pattern.candleIndex + horizon]; if (!future || pattern.direction === "neutral") return null;
  const entry = candles[pattern.candleIndex].close; return pattern.direction === "bullish" ? future.close > entry : future.close < entry;
}

export function enrichPatternReliability(detections: PatternDetection[], candles: Candle[], statusByIndex?: Map<number, PatternStatus>) {
  const closes = candles.map((candle) => candle.close); const rsiValues = rsi(candles); const fast = ema(closes, 12); const slow = ema(closes, 26); const macd = fast.map((value, cursor) => value - slow[cursor]);
  return detections.map((pattern) => {
    const candle = candles[pattern.candleIndex]; const volumeAverage = average(candles.slice(Math.max(0, pattern.candleIndex - 20), pattern.candleIndex).map((item) => item.volume).filter((value): value is number => Number.isFinite(value)));
    const volumeRatio = volumeAverage > 0 ? (candle.volume ?? volumeAverage) / volumeAverage : 1; const atr = recentAverageRange(candles, pattern.candleIndex); const atrRatio = atr > 0 ? (candle.high - candle.low) / atr : 1;
    const cluster = detections.filter((item) => item.candleIndex === pattern.candleIndex && item.direction === pattern.direction && item.name !== pattern.name).map((item) => item.name);
    const history = detections.filter((item) => item.name === pattern.name && item.direction === pattern.direction && item.candleIndex < pattern.candleIndex - 3).map((item) => historicalOutcome(item, candles)).filter((item): item is boolean => item !== null);
    const historicalWinRate = history.length ? Math.round(history.filter(Boolean).length / history.length * 100) : null; const divergence = divergenceAt(candles, rsiValues, macd, pattern.candleIndex, pattern.direction);
    const reliability: PatternReliability = { closedCandle: (statusByIndex?.get(pattern.candleIndex) ?? pattern.status) === "confirmed", volumeRatio: Number(volumeRatio.toFixed(2)), volumeConfirmed: volumeRatio >= 1.2, atrRatio: Number(atrRatio.toFixed(2)), locationConfirmed: pattern.debug.locationScore >= 75, trendAligned: pattern.debug.trendAlignmentScore >= 70, session: marketSession(pattern.timestamp), cluster: cluster as PatternName[], divergence, historicalSamples: history.length, historicalWinRate };
    const reliabilityAdjustment = (reliability.volumeConfirmed ? 3 : volumeRatio < .7 ? -3 : 0) + (atrRatio >= .8 && atrRatio <= 2.5 ? 2 : atrRatio > 3 ? -2 : 0) + (cluster.length ? Math.min(5, cluster.length * 2) : 0) + (divergence ? 4 : 0) + (historicalWinRate !== null && history.length >= 3 ? Math.max(-6, Math.min(6, (historicalWinRate - 50) * .2)) : 0);
    const confidence = Math.round(Math.max(1, Math.min(99, pattern.confidence + reliabilityAdjustment)));
    const reason = [...pattern.reason, reliability.volumeConfirmed ? `Volume confirmed at ${reliability.volumeRatio.toFixed(2)}× average` : `Volume was ${reliability.volumeRatio.toFixed(2)}× average`, `Range was ${reliability.atrRatio.toFixed(2)}× ATR`, `${reliability.session} session`, ...(cluster.length ? [`Confluence cluster: ${cluster.join(", ")}`] : []), ...(divergence ? [divergence] : []), ...(historicalWinRate !== null ? [`Historical ${pattern.name} follow-through: ${historicalWinRate}% across ${history.length} samples`] : [])];
    return { ...pattern, confidence, strength: confidence >= 78 ? "high" as const : confidence >= 60 ? "medium" as const : "low" as const, reason, reliability, debug: { ...pattern.debug, finalScore: confidence } };
  });
}
