import type { ExplanationMode, RuleBasedSetup, TradingAssistantExplanation } from "./types";

export function fallbackExplanation(facts: RuleBasedSetup, mode: ExplanationMode = "standard"): TradingAssistantExplanation {
  const prefix = mode === "beginner" ? `${facts.preference} means the current evidence does not justify a stronger action.` : mode === "advanced" ? `The deterministic multi-timeframe model resolves to ${facts.preference} with a ${facts.setupScore}/100 setup score.` : `${facts.preference} is preferred by the rule-based setup engine.`;
  return { preference: facts.preference, setupScore: facts.setupScore, confidenceLabel: facts.confidenceLabel, summary: prefix, reasons: facts.ruleReasons.slice(0, 6), warnings: facts.ruleWarnings.slice(0, 6), whatWouldInvalidate: facts.invalidationFacts.slice(0, 6), whatToWatchNext: facts.watchFacts.slice(0, 6) };
}

export function fallbackChat(question: string, facts: RuleBasedSetup) {
  const normalized = question.toLowerCase();
  if (normalized.includes("why") && normalized.includes("wait")) return facts.preference === "WAIT" ? `The setup remains WAIT because ${facts.ruleWarnings.join(", ").toLowerCase() || "the required conditions are incomplete"}. Buy score is ${facts.buyScore.total}; sell score is ${facts.sellScore.total}.` : `The current calculated preference is ${facts.preference}, not WAIT. Its setup score is ${facts.setupScore}/100.`;
  if (normalized.includes("support")) return facts.setup1H.support ? `The nearest calculated support zone is ${facts.setup1H.support.low}–${facts.setup1H.support.high}. Current 1H location is ${facts.setup1H.location}.` : "No confirmed 1H support zone is available in the current analysis.";
  if (normalized.includes("hh") || normalized.includes("hl")) return `The current 4H structure is ${facts.trend4H.structure.join(" + ")}. HH means higher high; HL means higher low.`;
  if (normalized.includes("sell")) return `A sell preference would require the sell score to reach the configured threshold with a clear edge, confirmed bearish 15M evidence, and acceptable risk/reward. Current sell score is ${facts.sellScore.total}.`;
  return `Current preference is ${facts.preference} with a ${facts.setupScore}/100 setup score. ${facts.ruleReasons.slice(0, 2).join(" ")}`;
}
