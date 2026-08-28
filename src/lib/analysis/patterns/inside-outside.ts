import type { PatternDetectorContext, RawPattern } from "./types";

export function detectInsideOutside({ candles, index, metrics }: PatternDetectorContext): RawPattern[] {
  if (index < 1) return []; const current = candles[index]; const previous = candles[index - 1];
  if (current.high < previous.high && current.low > previous.low) return [{ name: "Inside Bar", abbreviation: "IB", direction: "neutral", shapeScore: 70, reasons: ["Entire candle range is contained inside the previous range", "Volatility contracted and direction remains unresolved"] }];
  if (current.high > previous.high && current.low < previous.low) return [{ name: "Outside Bar", abbreviation: "OB", direction: metrics.bullish ? "bullish" : metrics.bearish ? "bearish" : "neutral", shapeScore: 76, reasons: ["Candle exceeded both sides of the previous range", "The close indicates which side retained control"] }];
  return [];
}
