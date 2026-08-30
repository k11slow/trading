import { describe, expect, it } from "vitest";
import type { Candle } from "@/lib/market-data/types";
import { detectCandlestickPatterns, type SupportResistanceZone, type TimeframeStructureAnalysis, type TrendDirection } from "@/lib/analysis";

const bar = (time: number, open: number, high: number, low: number, close: number): Candle => ({ time, open, high, low, close, volume: 100 });
const base = () => Array.from({ length: 12 }, (_, index) => bar(index, 10 + (index % 2) * .1, 10.65, 9.45, 10.1 - (index % 2) * .1));
const zone = (type: "support" | "resistance", low: number, high: number): SupportResistanceZone => ({ id: `${type}-${low}`, type, low, high, midpoint: (low + high) / 2, strength: 90, touches: 3, lastTouchedAt: 5 });
const structure = (trend: TrendDirection = "sideways", zones: SupportResistanceZone[] = []): TimeframeStructureAnalysis => ({ timeframe: "15m", swings: [], labels: [], trend: { trend, confidence: 80, bullishSignals: trend === "bullish" ? 4 : 0, bearishSignals: trend === "bearish" ? 4 : 0 }, zones, roleReversals: [], latestStructure: "Mixed", analyzedThrough: 10 });
const detect = (ending: Candle[], context = structure(), majorTrend: TrendDirection = context.trend.trend) => detectCandlestickPatterns([...base(), ...ending, bar(99, 10, 10.5, 9.5, 10.1)], "15m", context, { sensitivity: "high", majorTrend });
const namesAt = (patterns: ReturnType<typeof detectCandlestickPatterns>, time: number) => patterns.filter((pattern) => pattern.timestamp === time).map((pattern) => pattern.name);

describe("candlestick shape detection", () => {
  it("detects bullish engulfing", () => { const patterns = detect([bar(20, 10.5, 10.7, 9.3, 9.5), bar(21, 9.4, 10.8, 9.2, 10.7)]); expect(namesAt(patterns, 21)).toContain("Bullish Engulfing"); });
  it("detects bearish engulfing", () => { const patterns = detect([bar(20, 9.5, 10.7, 9.3, 10.5), bar(21, 10.6, 10.8, 9.2, 9.4)]); expect(namesAt(patterns, 21)).toContain("Bearish Engulfing"); });
  it("detects a hammer", () => { const patterns = detect([bar(21, 10, 10.35, 8.8, 10.3)]); expect(namesAt(patterns, 21)).toContain("Hammer"); });
  it("detects a shooting star in bullish context", () => { const patterns = detect([bar(21, 10.1, 11.6, 10.05, 10.35)], structure("bullish")); expect(namesAt(patterns, 21)).toContain("Shooting Star"); });
  it("detects a doji", () => { const patterns = detect([bar(21, 10, 10.7, 9.85, 10.02)]); expect(namesAt(patterns, 21)).toContain("Doji"); });
  it("detects a spinning top", () => { const patterns = detect([bar(21, 10, 10.7, 9.6, 10.2)]); expect(namesAt(patterns, 21)).toContain("Spinning Top"); });
  it("detects a morning star", () => { const patterns = detect([bar(19, 11, 11.1, 9.7, 9.8), bar(20, 9.75, 10, 9.5, 9.7), bar(21, 9.65, 10.8, 9.6, 10.7)]); expect(namesAt(patterns, 21)).toContain("Morning Star"); });
  it("detects an evening star", () => { const patterns = detect([bar(19, 9.8, 11.1, 9.7, 11), bar(20, 11.05, 11.3, 10.8, 11.1), bar(21, 11.15, 11.2, 9.9, 10)]); expect(namesAt(patterns, 21)).toContain("Evening Star"); });
  it("detects an inside bar", () => { const patterns = detect([bar(20, 10, 11, 9, 10.4), bar(21, 10.2, 10.7, 9.4, 10.3)]); expect(namesAt(patterns, 21)).toContain("Inside Bar"); });
  it("detects a long upper wick", () => { const patterns = detect([bar(21, 10, 11.7, 9.95, 10.3)]); expect(namesAt(patterns, 21)).toContain("Long Upper Wick"); });
  it("detects a long lower wick", () => { const patterns = detect([bar(21, 10.3, 10.35, 8.6, 10)]); expect(namesAt(patterns, 21)).toContain("Long Lower Wick"); });
  it("detects piercing line and dark cloud cover reversals", () => {
    expect(namesAt(detect([bar(20, 11, 11.1, 9.8, 10), bar(21, 9.95, 10.7, 9.8, 10.6)]), 21)).toContain("Piercing Line");
    expect(namesAt(detect([bar(20, 10, 11.1, 9.9, 11), bar(21, 11.05, 11.2, 10.3, 10.4)]), 21)).toContain("Dark Cloud Cover");
  });
  it("detects harami and tweezer reversals", () => {
    expect(namesAt(detect([bar(20, 11, 11.1, 9.8, 10), bar(21, 10.2, 10.7, 10.1, 10.6)]), 21)).toContain("Bullish Harami");
    expect(namesAt(detect([bar(20, 10.7, 11.05, 9.8, 10), bar(21, 10, 10.8, 9.81, 10.7)]), 21)).toContain("Tweezer Bottom");
  });
  it("detects three inside confirmation", () => {
    const pattern = detect([bar(19, 11, 11.1, 9.8, 10), bar(20, 10.2, 10.7, 10.1, 10.6), bar(21, 10.5, 11.3, 10.4, 11.2)]);
    expect(namesAt(pattern, 21)).toContain("Three Inside Up");
  });
  it("detects specialized doji and configurable pin-bar geometry", () => {
    expect(namesAt(detect([bar(21, 10.3, 10.34, 8.7, 10.31)]), 21)).toContain("Dragonfly Doji");
    expect(namesAt(detect([bar(21, 10, 10.28, 8.5, 10.22)]), 21)).toContain("Bullish Pin Bar");
  });
  it("detects a liquidity sweep that reclaims recent lows", () => {
    const lead = [bar(16, 10, 10.6, 9.5, 10.1), bar(17, 10.1, 10.7, 9.55, 10.2), bar(18, 10.2, 10.8, 9.6, 10.3), bar(19, 10.3, 10.7, 9.52, 10.2), bar(20, 10.2, 10.6, 9.51, 10.1)];
    expect(namesAt(detect([...lead, bar(21, 10.05, 10.5, 9.1, 9.8)]), 21)).toContain("Bullish Liquidity Sweep");
  });
});

describe("pattern state and contextual scoring", () => {
  const engulfing = [bar(20, 10.5, 10.7, 9.3, 9.5), bar(21, 9.4, 10.8, 9.2, 10.7)];
  it("keeps a pattern on the current candle forming", () => { const candles = [...base(), ...engulfing]; const patterns = detectCandlestickPatterns(candles, "15m", structure(), { sensitivity: "high" }); expect(patterns.find((pattern) => pattern.timestamp === 21 && pattern.name === "Bullish Engulfing")?.status).toBe("forming"); });
  it("scores bullish engulfing higher at support than mid-range", () => { const near = detect(engulfing, structure("sideways", [zone("support", 9.1, 9.45)])).find((pattern) => pattern.timestamp === 21 && pattern.name === "Bullish Engulfing")!; const middle = detect(engulfing).find((pattern) => pattern.timestamp === 21 && pattern.name === "Bullish Engulfing")!; expect(near.confidence).toBeGreaterThan(middle.confidence); });
  it("scores a shooting star higher at resistance", () => { const star = [bar(21, 10.1, 11.6, 10.05, 10.35)]; const near = detect(star, structure("bullish", [zone("resistance", 11.4, 11.7)]), "sideways").find((pattern) => pattern.name === "Shooting Star")!; const middle = detect(star, structure("bullish"), "sideways").find((pattern) => pattern.name === "Shooting Star")!; expect(near.confidence).toBeGreaterThan(middle.confidence); });
  it("filters an extremely tiny noisy candle", () => { const tiny = bar(21, 10, 10.006, 9.994, 10.0002); const patterns = detect([tiny]); expect(patterns.filter((pattern) => pattern.timestamp === 21)).toHaveLength(0); });
  it("reduces a bullish pattern against the 4H trend", () => { const aligned = detect(engulfing, structure("bullish"), "bullish").find((pattern) => pattern.name === "Bullish Engulfing")!; const against = detect(engulfing, structure("bullish"), "bearish").find((pattern) => pattern.name === "Bullish Engulfing")!; expect(against.confidence).toBeLessThan(aligned.confidence); expect(against.againstMajorTrend).toBe(true); });
  it("adds ATR, volume, session, cluster, and closed-candle reliability facts", () => {
    const pattern = detect(engulfing, structure("bullish"), "bullish").find((item) => item.name === "Bullish Engulfing")!;
    expect(pattern.reliability).toMatchObject({ closedCandle: true, trendAligned: true });
    expect(pattern.reliability?.atrRatio).toBeGreaterThan(0);
    expect(pattern.reliability?.volumeRatio).toBeGreaterThan(0);
    expect(pattern.reliability?.session).toBeTruthy();
    expect(pattern.reliability?.cluster.length).toBeGreaterThan(0);
  });
});
