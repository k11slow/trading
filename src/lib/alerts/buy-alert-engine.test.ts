import { describe, expect, it } from "vitest";
import type { RuleBasedSetup } from "@/lib/ai";
import {
  canEmitBuyAlert, createBuyAlert, defaultBuyAlertSettings, evaluateBuyAlert,
} from "./buy-alert-engine";

const settings = { ...defaultBuyAlertSettings, enabled: true };
function setup(overrides: Partial<RuleBasedSetup> = {}): RuleBasedSetup {
  return {
    symbol: "DOGE/USDT", category: "Meme Coins", price: .0845,
    calculatedAt: 1, stateKey: "confirmed-1",
    trend4H: { direction: "bullish", confidence: 90, structure: ["HH", "HL"] },
    setup1H: { location: "support", structure: "HL", support: { low: .08, high: .081, midpoint: .0805, strength: 90, touches: 3 }, resistance: { low: .1, high: .101, midpoint: .1005, strength: 90, touches: 3 }, roleReversal: null },
    confirmation15M: { direction: "bullish", confirmed: true, forming: false, pattern: "Bullish Engulfing", score: 90 },
    patterns: { bullish: { name: "Bullish Engulfing", score: 90, status: "confirmed" }, bearish: null },
    riskReward: { direction: "buy", entry: .0845, stop: .08, target: .1, ratio: 2, valid: true, reason: "Valid" },
    buyScore: { total: 82, components: {} as never, breakdown: [] },
    sellScore: { total: 20, components: {} as never, breakdown: [] },
    technicalPreference: "BUY", technicalSetupScore: 82, preference: "BUY",
    setupScore: 82, setupQuality: "Strong", confidenceLabel: "Strong setup",
    newsRisk: { score: 10, label: "low", reasons: [], technicalPenalty: 0, upcomingEvent: null, relevantHeadlineIds: [] },
    ruleReasons: ["4H trend bullish", "1H support held", "15M bullish engulfing confirmed", "Risk/reward is 1:2.00"],
    ruleWarnings: [], buyConditions: [], sellConditions: [],
    invalidationFacts: ["Close below support"], watchFacts: ["Support should remain intact"],
    ...overrides,
  };
}
describe("AI BUY alert engine", () => {
  it("triggers for a qualified confirmed BUY", () => expect(evaluateBuyAlert(setup(), settings).trigger).toBe(true));
  it("blocks a forming candle", () => expect(evaluateBuyAlert(setup({ confirmation15M: { direction: "bullish", confirmed: false, forming: true, pattern: "Bullish Engulfing", score: 90 } }), settings).trigger).toBe(false));
  it("blocks a score below 75", () => expect(evaluateBuyAlert(setup({ buyScore: { total: 68, components: {} as never, breakdown: [] } }), settings).trigger).toBe(false));
  it("blocks high news risk", () => expect(evaluateBuyAlert(setup({ newsRisk: { score: 90, label: "high", reasons: [], technicalPenalty: 20, upcomingEvent: null, relevantHeadlineIds: [] } }), settings).trigger).toBe(false));
  it("blocks poor risk/reward", () => expect(evaluateBuyAlert(setup({ riskReward: { direction: "buy", entry: 1, stop: .9, target: 1.08, ratio: .8, valid: true, reason: "Poor" } }), settings).trigger).toBe(false));
  it("prevents duplicate spam for the same active setup", () => { const facts = setup(); const last = createBuyAlert(facts, 1_000); expect(canEmitBuyAlert(facts, last, settings, 9_000_000)).toBe(false); });
  it("allows a reformed setup after invalidation", () => { const facts = setup({ stateKey: "confirmed-2" }); const last = { ...createBuyAlert(setup(), 1_000), status: "Invalidated" as const }; expect(canEmitBuyAlert(facts, last, settings, 2_000)).toBe(true); });
});
