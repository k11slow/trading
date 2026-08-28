import type { Candle } from "@/lib/market-data/types";
import type { SwingPoint, SwingSensitivity } from "./types";

const settings: Record<SwingSensitivity, { window: number; prominence: number }> = {
  low: { window: 2, prominence: .35 }, medium: { window: 3, prominence: .6 }, high: { window: 5, prominence: .9 },
};

export function averageTrueRange(candles: Candle[], period = 14) {
  if (candles.length < 2) return 0;
  const start = Math.max(1, candles.length - period);
  let sum = 0;
  for (let i = start; i < candles.length; i++) sum += Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close));
  return sum / Math.max(1, candles.length - start);
}

export function detectSwings(candles: Candle[], sensitivity: SwingSensitivity = "medium"): SwingPoint[] {
  const config = settings[sensitivity];
  if (candles.length < config.window * 2 + 3) return [];
  const atr = averageTrueRange(candles, Math.min(50, candles.length - 1));
  const minimumProminence = atr * config.prominence;
  const points: SwingPoint[] = [];
  for (let index = config.window; index < candles.length - config.window; index++) {
    const candle = candles[index]; const neighbors = candles.slice(index - config.window, index + config.window + 1);
    const isHigh = neighbors.every((item, offset) => offset === config.window || candle.high > item.high);
    const isLow = neighbors.every((item, offset) => offset === config.window || candle.low < item.low);
    if (isHigh) {
      const leftLow = Math.min(...candles.slice(index - config.window, index).map((item) => item.low)); const rightLow = Math.min(...candles.slice(index + 1, index + config.window + 1).map((item) => item.low)); const prominence = candle.high - Math.max(leftLow, rightLow);
      if (prominence >= minimumProminence) points.push({ index, time: candle.time, price: candle.high, type: "high", confirmed: true, prominence });
    }
    if (isLow) {
      const leftHigh = Math.max(...candles.slice(index - config.window, index).map((item) => item.high)); const rightHigh = Math.max(...candles.slice(index + 1, index + config.window + 1).map((item) => item.high)); const prominence = Math.min(leftHigh, rightHigh) - candle.low;
      if (prominence >= minimumProminence) points.push({ index, time: candle.time, price: candle.low, type: "low", confirmed: true, prominence });
    }
  }
  return points.sort((a, b) => a.index - b.index);
}
