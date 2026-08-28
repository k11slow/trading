import type { Candle } from "@/lib/market-data/types";
import type { CandleMetrics } from "./types";

export function candleMetrics(candle: Candle): CandleMetrics {
  const range = Math.max(Number.EPSILON, candle.high - candle.low); const body = Math.abs(candle.close - candle.open); const upperWick = candle.high - Math.max(candle.open, candle.close); const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  return { range, body, upperWick, lowerWick, bodyRatio: body / range, upperWickRatio: upperWick / range, lowerWickRatio: lowerWick / range, bullish: candle.close > candle.open, bearish: candle.close < candle.open };
}
export function recentAverageRange(candles: Candle[], index: number, period = 20) { const sample = candles.slice(Math.max(0, index - period), index); return sample.length ? sample.reduce((sum, candle) => sum + candle.high - candle.low, 0) / sample.length : candles[index].high - candles[index].low; }
