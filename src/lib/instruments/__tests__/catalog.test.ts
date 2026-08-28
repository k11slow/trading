import { afterEach, describe, expect, it, vi } from "vitest";
import { getCatalog } from "../catalog";
import { isMemeAsset } from "../meme-classifier";
describe("dynamic provider catalog", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("classifies known meme assets without frontend symbol lists", () => { expect(isMemeAsset("DOGE")).toBe(true); expect(isMemeAsset("BRETT")).toBe(true); expect(isMemeAsset("UNKNOWNTOKEN")).toBe(false); });
  it("handles a provider universe larger than 1,000 pairs", async () => { const symbols = Array.from({ length: 1_205 }, (_, index) => ({ symbol: `TOKEN${index}USDT`, status: "TRADING", baseAsset: `TOKEN${index}`, quoteAsset: "USDT", isSpotTradingAllowed: true })); symbols.push({ symbol: "DOGEUSDT", status: "TRADING", baseAsset: "DOGE", quoteAsset: "USDT", isSpotTradingAllowed: true }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ symbols }), { status: 200 }))); const crypto = await getCatalog("Crypto"); const memes = await getCatalog("Meme Coins"); expect(crypto.value.length).toBeGreaterThan(1_000); expect(memes.value.some((item) => item.symbol === "DOGE/USDT")).toBe(true); });
});
