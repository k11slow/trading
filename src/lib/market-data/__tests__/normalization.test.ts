import { describe, expect, it } from "vitest";
import { canonicalSymbol, normalizeMarketAsset } from "@/lib/market-data";

describe("market asset normalization", () => {
  it("canonicalizes compact forex provider symbols", () => {
    expect(canonicalSymbol("eurusd", "Forex")).toBe("EUR/USD");
  });

  it("migrates a stale unavailable favorite to its live catalog identity", () => {
    const asset = normalizeMarketAsset({
      symbol: "EURUSD", name: "EURUSD", exchange: "Unknown", category: "Forex",
      price: 0, change: 0, decimals: 5, volatility: 0, dataStatus: "UNAVAILABLE",
    });
    expect(asset.symbol).toBe("EUR/USD");
    expect(asset.name).toBe("Euro / U.S. Dollar");
    expect(asset.dataStatus).toBeUndefined();
  });
});
