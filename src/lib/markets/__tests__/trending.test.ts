import { afterEach, describe, expect, it, vi } from "vitest";
import { getBinanceTrending } from "../binance-trending";
const ticker = (
  symbol: string,
  change: number,
  volume: number,
  count: number,
  high = 110,
  low = 90,
) => ({
  symbol,
  lastPrice: "100",
  priceChangePercent: String(change),
  quoteVolume: String(volume),
  highPrice: String(high),
  lowPrice: String(low),
  weightedAvgPrice: "100",
  count,
});
describe("real activity rankings", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("ranks the dynamic provider universe without inventing AI scores", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify([
              ticker("BTCUSDT", 2, 1_000_000, 10_000),
              ticker("ETHUSDT", 8, 100_000, 2_000),
              ticker("UNKNOWNUSDT", 50, 9_000_000, 90_000),
            ]),
            { status: 200 },
          ),
        ),
    );
    const result = await getBinanceTrending("Crypto", "Trending");
    expect(result.map((item) => item.symbol)).toContain("UNKNOWN/USDT");
    expect(
      result.every(
        (item) =>
          item.source === "LIVE" &&
          item.provider === "Binance" &&
          item.aiSetupScore === null,
      ),
    ).toBe(true);
    expect(result[0].trendingScore).toBeGreaterThanOrEqual(
      result[1].trendingScore,
    );
  });
  it("keeps meme coins in the high-risk ranking", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify([
              ticker("DOGEUSDT", 4, 800_000, 8_000),
              ticker("BTCUSDT", 2, 2_000_000, 20_000),
            ]),
            { status: 200 },
          ),
        ),
    );
    const result = await getBinanceTrending("Meme Coins", "Most Active");
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("DOGE/USDT");
    expect(result[0].highRisk).toBe(true);
  });
  it("sorts gainers and losers by real session change", async () => {
    const rows = JSON.stringify([
      ticker("BTCUSDT", -3, 1_000, 100),
      ticker("ETHUSDT", 7, 1_000, 100),
    ]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async () => new Response(rows, { status: 200 })),
    );
    expect((await getBinanceTrending("Crypto", "Top Gainers"))[0].symbol).toBe(
      "ETH/USDT",
    );
    expect((await getBinanceTrending("Crypto", "Top Losers"))[0].symbol).toBe(
      "BTC/USDT",
    );
  });
});
