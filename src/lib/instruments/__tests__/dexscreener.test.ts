import { describe, expect, it } from "vitest";
import { normalizeDexPair } from "../dexscreener";

describe("DEX token normalization", () => {
  it("uses chain and contract identity instead of a reused ticker", () => {
    const token = normalizeDexPair({
      chainId: "solana", dexId: "raydium", pairAddress: "pair-1",
      baseToken: { address: "MintABC", name: "Cat Token", symbol: "CAT" },
      quoteToken: { address: "So111", name: "Solana", symbol: "SOL" },
      priceUsd: "0.0001", liquidity: { usd: 5_000 }, pairCreatedAt: Date.now() - 60_000,
      volume: { h24: 20_000 }, priceChange: { h24: 80 }, txns: { h24: { buys: 20, sells: 10 } },
    });
    expect(token?.id).toBe("solana:mintabc");
    expect(token?.pairAddress).toBe("pair-1");
    expect(token?.riskFlags).toEqual(expect.arrayContaining(["VERY LOW LIQUIDITY", "NEW TOKEN", "INSUFFICIENT HISTORY"]));
  });
});
