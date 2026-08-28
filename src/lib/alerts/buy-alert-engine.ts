import type { MarketCategory } from "@/lib/market-data/types";
import type { RuleBasedSetup } from "@/lib/ai";

export type AlertFrequency = "conservative" | "balanced" | "aggressive";
export type BuyAlertSettings = {
  enabled: boolean; minimumBuyScore: number; minimumEdge: number;
  minimumRiskReward: number; requireConfirmation: boolean;
  blockHighNewsRisk: boolean; resistanceBufferPercent: number;
  cooldownMinutes: number; frequency: AlertFrequency;
  markets: MarketCategory[];
};
export type AlertStatus = "Triggered" | "Viewed" | "Invalidated" | "Expired";
export type BuyAlertRecord = {
  id: string; timestamp: number; symbol: string; market: MarketCategory;
  preference: "BUY"; buyScore: number; sellScore: number; price: number;
  trend4H: string; setup1H: string; confirmation15M: string;
  pattern: string | null; support: number | null; resistance: number | null;
  riskReward: number; newsRisk: string; alertType: "BUY";
  quality: "GOOD BUY SETUP" | "STRONG BUY SETUP" | "VERY STRONG BUY SETUP";
  status: AlertStatus; stateKey: string; reasons: string[];
  invalidationFacts: string[]; watchFacts: string[];
};
export type BuyAlertDecision = { trigger: boolean; reasons: string[]; blockers: string[] };

export const defaultBuyAlertSettings: BuyAlertSettings = {
  enabled: false, minimumBuyScore: 75, minimumEdge: 15,
  minimumRiskReward: 1.5, requireConfirmation: true,
  blockHighNewsRisk: true, resistanceBufferPercent: .3,
  cooldownMinutes: 60, frequency: "balanced",
  markets: ["Forex", "Stocks", "Futures", "Crypto", "Meme Coins"],
};
export const frequencySettings = (frequency: AlertFrequency): Partial<BuyAlertSettings> =>
  frequency === "conservative" ? { frequency, minimumBuyScore: 82, minimumEdge: 20, minimumRiskReward: 2, requireConfirmation: true }
    : frequency === "aggressive" ? { frequency, minimumBuyScore: 70, minimumEdge: 10, minimumRiskReward: 1.2, requireConfirmation: true }
      : { frequency, minimumBuyScore: 75, minimumEdge: 15, minimumRiskReward: 1.5, requireConfirmation: true };
export const buyAlertQuality = (score: number): BuyAlertRecord["quality"] =>
  score >= 90 ? "VERY STRONG BUY SETUP" : score >= 80 ? "STRONG BUY SETUP" : "GOOD BUY SETUP";

export function evaluateBuyAlert(setup: RuleBasedSetup, settings: BuyAlertSettings): BuyAlertDecision {
  const blockers: string[] = [];
  if (!settings.enabled) blockers.push("Buy alerts are disabled");
  if (!settings.markets.includes(setup.category)) blockers.push("Market is not monitored");
  if (setup.preference !== "BUY") blockers.push("AI preference is not BUY");
  if (setup.buyScore.total < settings.minimumBuyScore) blockers.push("BUY score is below minimum");
  if (setup.buyScore.total - setup.sellScore.total < settings.minimumEdge) blockers.push("BUY edge is too small");
  if (settings.requireConfirmation && (!setup.confirmation15M.confirmed || setup.confirmation15M.forming || setup.confirmation15M.direction !== "bullish")) blockers.push("15M bullish confirmation is not closed and confirmed");
  if (!setup.riskReward.valid || setup.riskReward.direction !== "buy" || (setup.riskReward.ratio ?? 0) < settings.minimumRiskReward) blockers.push("Risk/reward is below minimum");
  if (settings.blockHighNewsRisk && setup.newsRisk.label === "high") blockers.push("High news risk");
  const resistance = setup.setup1H.resistance;
  if (resistance?.strength && resistance.strength >= 75 && resistance.low > setup.price && ((resistance.low - setup.price) / setup.price) * 100 <= settings.resistanceBufferPercent) blockers.push("Price is directly under strong resistance");
  return { trigger: blockers.length === 0, blockers, reasons: setup.ruleReasons.filter((reason) => !/SELL score/i.test(reason)).slice(0, 5) };
}

export function createBuyAlert(setup: RuleBasedSetup, now = Date.now()): BuyAlertRecord {
  return {
    id: `${setup.symbol}:${setup.stateKey}:${now}`, timestamp: now,
    symbol: setup.symbol, market: setup.category, preference: "BUY",
    buyScore: setup.buyScore.total, sellScore: setup.sellScore.total,
    price: setup.price, trend4H: `${setup.trend4H.direction} (${setup.trend4H.confidence}%)`,
    setup1H: `${setup.setup1H.location} • ${setup.setup1H.structure}`,
    confirmation15M: setup.confirmation15M.confirmed ? "Confirmed" : "Not confirmed",
    pattern: setup.confirmation15M.pattern,
    support: setup.setup1H.support?.low ?? null,
    resistance: setup.setup1H.resistance?.high ?? null,
    riskReward: setup.riskReward.ratio!, newsRisk: setup.newsRisk.label,
    alertType: "BUY", quality: buyAlertQuality(setup.buyScore.total),
    status: "Triggered", stateKey: setup.stateKey,
    reasons: setup.ruleReasons.slice(0, 5),
    invalidationFacts: setup.invalidationFacts, watchFacts: setup.watchFacts,
  };
}

export function canEmitBuyAlert(setup: RuleBasedSetup, last: BuyAlertRecord | undefined, settings: BuyAlertSettings, now: number) {
  if (!last || last.status === "Invalidated" || last.status === "Expired") return true;
  if (last.stateKey === setup.stateKey) return false;
  return now - last.timestamp >= settings.cooldownMinutes * 60_000;
}
