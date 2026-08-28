import { describe, expect, it } from "vitest";
import { findAsset } from "@/lib/market-data";
import { deduplicateNews } from "../dedupe";
import { assessNewsRisk } from "../risk";
import type { EconomicEvent, NewsArticle } from "../types";

const now = Date.UTC(2026, 7, 26, 12);
const event = (title: string, currency: string, minutes: number, impact: EconomicEvent["impact"] = "high"): EconomicEvent => ({ id: `${title}-${currency}`, title, country: currency === "USD" ? "US" : currency.slice(0, 2), currency, timestamp: now + minutes * 60_000, impact, status: "upcoming", source: "Test calendar" });
const article = (id: string, headline: string, source = "Reuters", minutesAgo = 5): NewsArticle => ({ id, headline, source, publishedAt: now - minutesAgo * 60_000, category: "general", relatedSymbols: [], relatedCurrencies: [], impact: "high", sourceQuality: source === "Reuters" ? .98 : .6, direction: "uncertain" });

describe("deterministic symbol news risk", () => {
  it("A: rates EUR/USD high for USD CPI in 15 minutes", () => { const risk = assessNewsRisk(findAsset("EUR/USD"), [event("US CPI", "USD", 15)], [], now); expect(risk.label).toBe("high"); expect(risk.technicalPenalty).toBe(20); });
  it("B: keeps an unrelated JPY event low for EUR/USD", () => { const risk = assessNewsRisk(findAsset("EUR/USD"), [event("Japan CPI", "JPY", 15)], [], now); expect(risk.label).toBe("low"); expect(risk.score).toBeLessThanOrEqual(30); });
  it("C: rates GOLD high before a Fed decision", () => { const risk = assessNewsRisk(findAsset("GOLD"), [event("Federal Reserve rate decision", "USD", 20)], [], now); expect(risk.label).toBe("high"); });
  it("D: keeps BTC risk low for a minor ECB speech", () => { const risk = assessNewsRisk(findAsset("BTC/USDT"), [event("ECB minor speech", "EUR", 20, "low")], [], now); expect(risk.label).toBe("low"); });
  it("E: treats a major Trump tariff headline as highly relevant to TRUMP/USDT", () => { const risk = assessNewsRisk(findAsset("TRUMP/USDT"), [], [article("trump-1", "Trump announces major new tariffs in China trade action")], now); expect(risk.label).toBe("high"); expect(risk.relevantBreakingNews[0].relevance).toBeGreaterThanOrEqual(.85); });
  it("F: deduplicates substantially similar headlines", () => { const result = deduplicateNews([article("1", "Fed official comments on inflation outlook"), article("2", "Fed official comments on the inflation outlook", "Bloomberg", 6), article("3", "Oil supply rises after OPEC meeting")]); expect(result).toHaveLength(2); });
  it("G: provider unavailability creates no penalty", () => { const risk = assessNewsRisk(findAsset("EUR/USD"), [], [], now, false); expect(risk.label).toBe("unavailable"); expect(risk.technicalPenalty).toBe(0); });
});
