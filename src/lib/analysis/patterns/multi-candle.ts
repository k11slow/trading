import { candleMetrics } from "./metrics";
import type { PatternDetectorContext, RawPattern } from "./types";

export function detectMultiCandle({ candles, index }: PatternDetectorContext): RawPattern[] {
  const results: RawPattern[] = [];
  if (index >= 2) {
    const three = candles.slice(index - 2, index + 1); const metrics = three.map(candleMetrics);
    const white = metrics.every((item) => item.bullish && item.bodyRatio >= .5) && three[1].close > three[0].close && three[2].close > three[1].close && three[1].open >= Math.min(three[0].open, three[0].close) && three[2].open >= Math.min(three[1].open, three[1].close);
    const black = metrics.every((item) => item.bearish && item.bodyRatio >= .5) && three[1].close < three[0].close && three[2].close < three[1].close && three[1].open <= Math.max(three[0].open, three[0].close) && three[2].open <= Math.max(three[1].open, three[1].close);
    if (white) results.push({ name: "Three White Soldiers", abbreviation: "3WS", direction: "bullish", shapeScore: 90, reasons: ["Three consecutive strong bullish bodies", "Each candle advanced and closed above the previous one"] });
    if (black) results.push({ name: "Three Black Crows", abbreviation: "3BC", direction: "bearish", shapeScore: 90, reasons: ["Three consecutive strong bearish bodies", "Each candle declined and closed below the previous one"] });
  }
  if (index >= 4) {
    const group = candles.slice(index - 4, index + 1); const first = candleMetrics(group[0]); const last = candleMetrics(group[4]); const middle = group.slice(1, 4); const insideFirstRange = middle.every((candle) => candle.high < group[0].high && candle.low > group[0].low);
    if (first.bullish && first.bodyRatio >= .55 && insideFirstRange && last.bullish && last.bodyRatio >= .5 && group[4].close > group[0].close) results.push({ name: "Rising Three Methods", abbreviation: "R3", direction: "bullish", shapeScore: 88, reasons: ["A strong bullish candle contained three smaller consolidation candles", "The fifth candle resumed the advance"] });
    if (first.bearish && first.bodyRatio >= .55 && insideFirstRange && last.bearish && last.bodyRatio >= .5 && group[4].close < group[0].close) results.push({ name: "Falling Three Methods", abbreviation: "F3", direction: "bearish", shapeScore: 88, reasons: ["A strong bearish candle contained three smaller consolidation candles", "The fifth candle resumed the decline"] });
  }
  return results;
}
