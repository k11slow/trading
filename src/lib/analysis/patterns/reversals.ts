import { candleMetrics } from "./metrics";
import type { PatternDetectorContext, RawPattern } from "./types";

export function detectReversalPatterns({ candles, index, metrics }: PatternDetectorContext): RawPattern[] {
  const results: RawPattern[] = [];
  const current = candles[index];
  if (metrics.bodyRatio <= .12 && metrics.lowerWickRatio >= .62 && metrics.upperWickRatio <= .12)
    results.push({ name: "Dragonfly Doji", abbreviation: "DD", direction: "bullish", shapeScore: 88, reasons: ["Open and close are near the high", "A long lower wick rejected lower prices"] });
  if (metrics.bodyRatio <= .12 && metrics.upperWickRatio >= .62 && metrics.lowerWickRatio <= .12)
    results.push({ name: "Gravestone Doji", abbreviation: "GD", direction: "bearish", shapeScore: 88, reasons: ["Open and close are near the low", "A long upper wick rejected higher prices"] });
  if (metrics.bodyRatio >= .12 && metrics.lowerWick >= metrics.body * 2.5 && metrics.upperWick <= metrics.body * .5)
    results.push({ name: "Bullish Pin Bar", abbreviation: "PB+", direction: "bullish", shapeScore: Math.min(95, 76 + metrics.lowerWickRatio * 20), reasons: ["Lower wick is at least 2.5 times the body", "The close rejected the candle low"] });
  if (metrics.bodyRatio >= .12 && metrics.upperWick >= metrics.body * 2.5 && metrics.lowerWick <= metrics.body * .5)
    results.push({ name: "Bearish Pin Bar", abbreviation: "PB−", direction: "bearish", shapeScore: Math.min(95, 76 + metrics.upperWickRatio * 20), reasons: ["Upper wick is at least 2.5 times the body", "The close rejected the candle high"] });
  if (index < 1) return results;
  const previous = candles[index - 1]; const prior = candleMetrics(previous); const priorMid = (previous.open + previous.close) / 2; const tolerance = Math.max(prior.range, metrics.range) * .08;
  if (prior.bearish && prior.bodyRatio >= .5 && metrics.bullish && current.open <= previous.close + tolerance && current.close > priorMid && current.close < previous.open)
    results.push({ name: "Piercing Line", abbreviation: "PL", direction: "bullish", shapeScore: 84, reasons: ["Price opened near the prior bearish close", "The bullish close recovered beyond the prior body midpoint"] });
  if (prior.bullish && prior.bodyRatio >= .5 && metrics.bearish && current.open >= previous.close - tolerance && current.close < priorMid && current.close > previous.open)
    results.push({ name: "Dark Cloud Cover", abbreviation: "DCC", direction: "bearish", shapeScore: 84, reasons: ["Price opened near the prior bullish close", "The bearish close fell beyond the prior body midpoint"] });
  const currentHighBody = Math.max(current.open, current.close); const currentLowBody = Math.min(current.open, current.close); const priorHighBody = Math.max(previous.open, previous.close); const priorLowBody = Math.min(previous.open, previous.close);
  if (prior.bearish && prior.bodyRatio >= .55 && metrics.bullish && currentHighBody < priorHighBody && currentLowBody > priorLowBody)
    results.push({ name: "Bullish Harami", abbreviation: "BH", direction: "bullish", shapeScore: 78, reasons: ["A small bullish body formed inside the previous bearish body", "Selling momentum contracted"] });
  if (prior.bullish && prior.bodyRatio >= .55 && metrics.bearish && currentHighBody < priorHighBody && currentLowBody > priorLowBody)
    results.push({ name: "Bearish Harami", abbreviation: "BH−", direction: "bearish", shapeScore: 78, reasons: ["A small bearish body formed inside the previous bullish body", "Buying momentum contracted"] });
  if (Math.abs(current.low - previous.low) <= tolerance && prior.bearish && metrics.bullish)
    results.push({ name: "Tweezer Bottom", abbreviation: "TB", direction: "bullish", shapeScore: 80, reasons: ["Two candles rejected nearly the same low", "Control shifted from sellers to buyers"] });
  if (Math.abs(current.high - previous.high) <= tolerance && prior.bullish && metrics.bearish)
    results.push({ name: "Tweezer Top", abbreviation: "TT", direction: "bearish", shapeScore: 80, reasons: ["Two candles rejected nearly the same high", "Control shifted from buyers to sellers"] });
  if (index < 2) return results;
  const first = candles[index - 2]; const firstMetrics = candleMetrics(first); const middle = candles[index - 1]; const middleMetrics = candleMetrics(middle);
  const middleInsideFirst = Math.max(middle.open, middle.close) < Math.max(first.open, first.close) && Math.min(middle.open, middle.close) > Math.min(first.open, first.close);
  if (firstMetrics.bearish && middleMetrics.bullish && middleInsideFirst && metrics.bullish && current.close > first.open)
    results.push({ name: "Three Inside Up", abbreviation: "3IU", direction: "bullish", shapeScore: 87, reasons: ["A bullish harami formed after a bearish candle", "The third candle confirmed above the first open"] });
  if (firstMetrics.bullish && middleMetrics.bearish && middleInsideFirst && metrics.bearish && current.close < first.open)
    results.push({ name: "Three Inside Down", abbreviation: "3ID", direction: "bearish", shapeScore: 87, reasons: ["A bearish harami formed after a bullish candle", "The third candle confirmed below the first open"] });
  const middleDoji = middleMetrics.bodyRatio <= .12;
  if (firstMetrics.bearish && middleDoji && middle.high < first.low && current.low > middle.high && metrics.bullish && current.close > (first.open + first.close) / 2)
    results.push({ name: "Abandoned Baby Bullish", abbreviation: "AB+", direction: "bullish", shapeScore: 94, reasons: ["An isolated doji gapped below the bearish candle", "A bullish gap and recovery confirmed reversal"] });
  if (firstMetrics.bullish && middleDoji && middle.low > first.high && current.high < middle.low && metrics.bearish && current.close < (first.open + first.close) / 2)
    results.push({ name: "Abandoned Baby Bearish", abbreviation: "AB−", direction: "bearish", shapeScore: 94, reasons: ["An isolated doji gapped above the bullish candle", "A bearish gap and decline confirmed reversal"] });
  return results;
}
