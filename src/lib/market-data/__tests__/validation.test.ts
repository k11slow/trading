import { describe, expect, it } from "vitest";
import { findAsset } from "@/lib/market-data";
import { ensureSingleSource, validateCandles } from "../validation";
const now = Date.UTC(2026, 7, 26, 12); const time = Math.floor(now / 1000); const valid = { time, open: 100, high: 102, low: 99, close: 101, volume: 10 };
describe("market candle validation", () => {
  it("rejects invalid OHLC geometry", () => { const result = validateCandles([{ ...valid, high: 100, close: 101 }], findAsset("AAPL"), now); expect(result.candles).toHaveLength(0); expect(result.rejected[0].reason).toBe("invalid-ohlc"); });
  it("rejects negative prices", () => { expect(validateCandles([{ ...valid, low: -1 }], undefined, now).rejected[0].reason).toBe("non-positive"); });
  it("rejects NaN prices", () => { expect(validateCandles([{ ...valid, close: Number.NaN }], undefined, now).rejected[0].reason).toBe("non-finite"); });
  it("deduplicates timestamps using the newest provider value", () => { const result = validateCandles([valid, { ...valid, close: 100.5 }], undefined, now); expect(result.candles).toHaveLength(1); expect(result.candles[0].close).toBe(100.5); expect(result.rejected.some((item) => item.reason === "duplicate-timestamp")).toBe(true); });
  it("rejects millisecond timestamps", () => { expect(validateCandles([{ ...valid, time: now }], undefined, now).rejected[0].reason).toBe("invalid-timestamp"); });
  it("never merges live and mock datasets", () => { expect(() => ensureSingleSource([{ source: "LIVE", data: [valid] }, { source: "MOCK", data: [valid] }])).toThrow(/cannot be merged/); });
  it("keeps a giant malformed candle out of the chart series", () => { const result = validateCandles([valid, { ...valid, time: time + 60, high: 100_000 }], undefined, now); expect(result.candles).toHaveLength(1); expect(result.rejected[0].reason).toBe("price-scale-outlier"); });
});
