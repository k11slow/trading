import { afterEach, describe, expect, it, vi } from "vitest";
import { MassiveFuturesDiscoveryProvider } from "../futures-provider";
import { MassiveFuturesMarketDataProvider } from "@/lib/market-data/providers/futures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Massive Futures provider", () => {
  it("discovers expiring Gold, Nasdaq, and Crude Oil contracts with metadata", async () => {
    vi.stubEnv("FUTURES_PROVIDER", "massive");
    vi.stubEnv("FUTURES_API_KEY", "test-key");
    const products = [
      { product_code: "GC", name: "Gold Futures", asset_class: "commodity", asset_sub_class: "metals", trading_venue: "XCEC" },
      { product_code: "NQ", name: "E-mini Nasdaq-100 Index Futures", asset_class: "financials", asset_sub_class: "equity", trading_venue: "XCME" },
      { product_code: "CL", name: "Light Sweet Crude Oil Futures", asset_class: "commodity", asset_sub_class: "energy", trading_venue: "XNYM" },
    ];
    const contracts = [
      { ticker: "GCZ26", product_code: "GC", trading_venue: "XCEC", last_trade_date: "2026-12-29" },
      { ticker: "NQZ26", product_code: "NQ", trading_venue: "XCME", last_trade_date: "2026-12-18" },
      { ticker: "CLX26", product_code: "CL", trading_venue: "XNYM", last_trade_date: "2026-11-20" },
    ];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(JSON.stringify({ status: "OK", results: url.includes("/products") ? products : contracts }));
    }));
    const rows = await new MassiveFuturesDiscoveryProvider().listContracts();
    expect(rows.map((row) => row.symbol)).toEqual(expect.arrayContaining(["GCZ26", "NQZ26", "CLX26"]));
    expect(rows.find((row) => row.symbol === "GCZ26")).toMatchObject({ displayName: "Gold Futures", exchange: "COMEX", contractMonth: "Dec 2026", futuresCategory: "Metals" });
  });

  it.each(["15m", "1H", "4H"] as const)("loads %s contract candles", async (timeframe) => {
    vi.stubEnv("FUTURES_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ status: "OK", results: [
      { ticker: "GCZ26", window_start: 1_800_000_000_000_000_000, open: 3000, high: 3010, low: 2990, close: 3005, volume: 42 },
      { ticker: "GCZ26", window_start: 1_799_000_000_000_000_000, open: 2990, high: 3005, low: 2980, close: 3000, volume: 30 },
    ] }))));
    const provider = new MassiveFuturesMarketDataProvider();
    const symbol = { symbol: "GCZ26", name: "Gold Futures", exchange: "COMEX", category: "Futures" as const, price: 1, change: 0, decimals: 2, volatility: .01 };
    expect((await provider.getCandles(symbol, timeframe)).data).toHaveLength(2);
    expect((await provider.getQuote(symbol)).data.price).toBe(3005);
  });
});
