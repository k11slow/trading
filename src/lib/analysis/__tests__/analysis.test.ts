import { describe, expect, it } from "vitest";
import type { Candle } from "@/lib/market-data/types";
import { classifyStructure, classifyTrend, detectRoleReversals, detectSwings, type StructureLabel, type SupportResistanceZone, type SwingPoint } from "@/lib/analysis";

const swing = (index: number, type: "high" | "low", price: number): SwingPoint => ({ index, time: index, type, price, confirmed: true, prominence: 2 });
const candle = (time: number, close: number, high = close + .5, low = close - .5): Candle => ({ time, open: close, high, low, close, volume: 100 });
const zone = (type: "support" | "resistance"): SupportResistanceZone => ({ id: `test-${type}`, type, low: 99, high: 101, midpoint: 100, strength: 80, touches: 3, lastTouchedAt: 2 });

describe("market structure classification", () => {
  it("classifies an uptrend as repeated HH + HL", () => {
    const labels = classifyStructure([swing(1, "high", 110), swing(2, "low", 100), swing(3, "high", 115), swing(4, "low", 104), swing(5, "high", 121), swing(6, "low", 109)]);
    expect(labels.map((item) => item.label)).toEqual(["HH", "HL", "HH", "HL"]);
    expect(classifyTrend(labels)).toMatchObject({ trend: "bullish" });
  });

  it("classifies a downtrend as repeated LH + LL", () => {
    const labels = classifyStructure([swing(1, "high", 121), swing(2, "low", 109), swing(3, "high", 116), swing(4, "low", 104), swing(5, "high", 111), swing(6, "low", 98)]);
    expect(labels.map((item) => item.label)).toEqual(["LH", "LL", "LH", "LL"]);
    expect(classifyTrend(labels)).toMatchObject({ trend: "bearish" });
  });

  it("keeps balanced mixed structure sideways", () => {
    const kinds = ["HH", "LL", "LH", "HL", "HH", "LL", "LH", "HL"] as const;
    const labels = kinds.map((label, index) => ({ ...swing(index, label === "HH" || label === "LH" ? "high" : "low", 100 + index), label, previousPrice: 100 })) as StructureLabel[];
    expect(classifyTrend(labels)).toMatchObject({ trend: "sideways" });
  });

  it("does not confirm a swing until right-side candles exist", () => {
    const confirmed = [candle(0, 10), candle(1, 11), candle(2, 12), candle(3, 16, 17, 15), candle(4, 13), candle(5, 12), candle(6, 11), candle(7, 10), candle(8, 9)];
    expect(detectSwings(confirmed, "medium").some((point) => point.time === 3 && point.type === "high")).toBe(true);
    const unfinished = [candle(0, 10), candle(1, 11), candle(2, 12), candle(3, 13), candle(4, 17, 18, 16)];
    expect(detectSwings(unfinished, "medium")).toHaveLength(0);
  });
});

describe("close-confirmed role reversal", () => {
  it("marks old support as new resistance after a close below and retest", () => {
    const candles = [candle(1, 103, 104, 102), candle(2, 101, 103, 99.5), candle(3, 98.5, 100, 98), candle(4, 97, 99, 96), candle(5, 99.4, 100.5, 97.5)];
    expect(detectRoleReversals(candles, [zone("support")])).toMatchObject([{ label: "Old Support → New Resistance", brokenAt: 3, retestedAt: 5 }]);
  });

  it("marks old resistance as new support after a close above and retest", () => {
    const candles = [candle(1, 97, 99, 96), candle(2, 99, 100.5, 98), candle(3, 101.5, 102, 100), candle(4, 103, 104, 102), candle(5, 100.6, 102, 99.5)];
    expect(detectRoleReversals(candles, [zone("resistance")])).toMatchObject([{ label: "Old Resistance → New Support", brokenAt: 3, retestedAt: 5 }]);
  });

  it("does not count a wick-only break", () => {
    const candles = [candle(1, 102, 103, 101), candle(2, 100, 102, 99), candle(3, 100.2, 101, 97.5), candle(4, 102, 103, 100)];
    expect(detectRoleReversals(candles, [zone("support")])).toEqual([]);
  });
});
