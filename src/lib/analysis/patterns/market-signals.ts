import type { PatternDetectorContext, RawPattern } from "./types";

export function detectMarketSignals({ candles, index, metrics, structure }: PatternDetectorContext): RawPattern[] {
  if (index < 5) return [];
  const current = candles[index]; const recent = candles.slice(index - 5, index); const priorLow = Math.min(...recent.map((candle) => candle.low)); const priorHigh = Math.max(...recent.map((candle) => candle.high)); const tolerance = metrics.range * .08; const results: RawPattern[] = [];
  if (current.low < priorLow - tolerance && current.close > priorLow && metrics.lowerWickRatio >= .35)
    results.push({ name: "Bullish Liquidity Sweep", abbreviation: "LS+", direction: "bullish", shapeScore: 89, reasons: ["Price swept below the recent five-candle low", "The candle closed back above the swept level"] });
  if (current.high > priorHigh + tolerance && current.close < priorHigh && metrics.upperWickRatio >= .35)
    results.push({ name: "Bearish Liquidity Sweep", abbreviation: "LS−", direction: "bearish", shapeScore: 89, reasons: ["Price swept above the recent five-candle high", "The candle closed back below the swept level"] });
  const support = structure.zones.filter((zone) => zone.type === "support").sort((a, b) => Math.abs(a.midpoint - current.close) - Math.abs(b.midpoint - current.close))[0];
  const resistance = structure.zones.filter((zone) => zone.type === "resistance").sort((a, b) => Math.abs(a.midpoint - current.close) - Math.abs(b.midpoint - current.close))[0];
  if (support && current.low < support.low && current.close > support.high)
    results.push({ name: "Bullish False Breakout", abbreviation: "FB+", direction: "bullish", shapeScore: 91, reasons: ["Price broke below confirmed support intrabar", "The candle reclaimed and closed above the support zone"] });
  if (resistance && current.high > resistance.high && current.close < resistance.low)
    results.push({ name: "Bearish False Breakout", abbreviation: "FB−", direction: "bearish", shapeScore: 91, reasons: ["Price broke above confirmed resistance intrabar", "The candle rejected and closed below the resistance zone"] });
  return results;
}
