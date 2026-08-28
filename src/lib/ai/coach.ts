import type { ExplanationMode, RuleBasedSetup } from "./types";
import type { Candle } from "@/lib/market-data/types";
export type CoachSignal = {
  tone: "good" | "caution" | "bad" | "forming";
  text: string;
};
export type TradingCoachView = {
  view: string;
  strength: string;
  marketNow: string;
  action: string;
  mainReason: string;
  buyers: string;
  sellers: string;
  controlExplanation: string;
  flow: {
    timeframe: string;
    title: string;
    explanation: string;
    technical: string;
  }[];
  candleStory: string[];
  candleOverall: string;
  pattern: {
    name: string;
    meaning: string;
    location: string;
    importance: string;
    status: string;
  } | null;
  signals: CoachSignal[];
  conflicts: { bullish: string[]; bearish: string[]; conclusion: string };
  riskReward: { label: string; value: string; meaning: string };
  location: string;
};
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const control = (score: number, other: number) =>
  score >= 75 && score - other >= 20
    ? "Strong"
    : score >= 55 && score > other
      ? "Getting stronger"
      : score >= 35
        ? "Medium"
        : "Weak";
export function buildTradingCoach(
  facts: RuleBasedSetup,
  mode: ExplanationMode = "beginner",
  recentCandles: Candle[] = [],
): TradingCoachView {
  void mode;
  const atResistance = facts.setup1H.location === "resistance";
  const atSupport = facts.setup1H.location === "support";
  const middle = facts.setup1H.location === "middle";
  const forming = facts.confirmation15M.forming;
  const confirmed = facts.confirmation15M.confirmed;
  const bullish = facts.trend4H.direction === "bullish";
  const bearish = facts.trend4H.direction === "bearish";
  const marketNow = facts.setup1H.roleReversal?.includes("Resistance")
    ? "Buyers broke resistance and price is testing whether it can hold as new support."
    : bullish && atResistance
      ? "Buyers have the stronger trend, but price is directly below resistance."
      : bearish && atSupport
        ? "Sellers control the bigger trend, but price is approaching support."
        : bullish
          ? "Buyers currently have the stronger market structure."
          : bearish
            ? "Sellers are in control and price is making a weaker structure."
            : "The market is sideways. Neither buyers nor sellers clearly controls it.";
  const actionBase =
    facts.preference === "BUY"
      ? "Intraday BUY signal is active. Use the calculated entry only while support and the closed 15-minute confirmation remain valid."
      : facts.preference === "SELL"
        ? "Intraday SELL signal is active. Use the calculated entry only while resistance and the closed 15-minute confirmation remain valid."
        : forming
          ? "Wait for the current 15-minute candle to close before deciding."
          : atResistance
            ? "Wait for either a confirmed breakout and retest or a clear rejection."
            : atSupport
              ? "Wait to see whether buyers defend support or sellers break it."
              : "Wait for price to reach an important level and produce confirmation.";
  const latestCandle = recentCandles.at(-1);
  const latestRange = latestCandle
    ? Math.max(latestCandle.high - latestCandle.low, Number.EPSILON)
    : 0;
  const largeBullishCandle = Boolean(
    latestCandle &&
    latestCandle.close > latestCandle.open &&
    Math.abs(latestCandle.close - latestCandle.open) / latestRange >= 0.65,
  );
  const action =
    atResistance && largeBullishCandle
      ? `${actionBase} Do not chase the large green candle into resistance; a pullback or retest offers a safer location.`
      : actionBase;
  const mainReason =
    facts.preference === "WAIT"
      ? forming
        ? "A potential signal is still forming and can disappear before the candle closes."
        : !facts.riskReward.valid
          ? "There is no valid entry, stop, and target combination yet."
          : middle
            ? "Price is in the middle of the range, where neither side has a location advantage."
            : facts.buyScore.total - facts.sellScore.total < 15 &&
                facts.sellScore.total - facts.buyScore.total < 15
              ? "Buyers and sellers are too evenly matched for a clear setup."
              : (facts.ruleWarnings[0] ??
                "The setup is missing a required confirmation.")
      : facts.ruleReasons[0];
  const buyers = control(facts.buyScore.total, facts.sellScore.total);
  const sellers = control(facts.sellScore.total, facts.buyScore.total);
  const flow = [
    {
      timeframe: "4H",
      title: bullish ? "UPTREND" : bearish ? "DOWNTREND" : "SIDEWAYS",
      explanation: bullish
        ? "The bigger market direction favors buyers."
        : bearish
          ? "The bigger market direction favors sellers."
          : "The bigger direction is unclear.",
      technical: facts.trend4H.structure.join(" + "),
    },
    {
      timeframe: "1H",
      title: facts.setup1H.location.toUpperCase(),
      explanation: facts.setup1H.roleReversal
        ? "Price is checking whether a previously broken level has changed its role."
        : atSupport
          ? "Price is testing an important floor."
          : atResistance
            ? "Price is testing an important ceiling."
            : "Price is away from the nearest confirmed support and resistance.",
      technical: facts.setup1H.structure,
    },
    {
      timeframe: "15M",
      title: confirmed
        ? "CONFIRMED"
        : forming
          ? "STILL FORMING"
          : "NO CONFIRMATION",
      explanation: confirmed
        ? `${facts.confirmation15M.pattern} has closed and confirmed.`
        : forming
          ? `${facts.confirmation15M.pattern ?? "A possible signal"} is not final until the candle closes.`
          : "There is no confirmed lower-timeframe entry signal.",
      technical: facts.confirmation15M.pattern ?? "None",
    },
  ];
  const candleStory = recentCandles.length
    ? recentCandles.slice(-5).map((candle, index, candles) => {
        const range = Math.max(candle.high - candle.low, Number.EPSILON);
        const bodyRatio = Math.abs(candle.close - candle.open) / range;
        const direction =
          candle.close > candle.open
            ? "bullish"
            : candle.close < candle.open
              ? "bearish"
              : "neutral";
        const strength =
          bodyRatio < 0.18
            ? "Small indecision"
            : bodyRatio >= 0.65
              ? "Strong"
              : "Moderate";
        const meaning =
          direction === "bullish"
            ? "buyers pushed price higher"
            : direction === "bearish"
              ? "sellers pushed price lower"
              : "neither side moved price";
        const status =
          index === candles.length - 1
            ? " Current candle — still forming and not confirmed."
            : " Closed candle.";
        return `Candle ${index + 1}: ${strength} ${direction} candle — ${meaning}.${status}`;
      })
    : facts.confirmation15M.pattern
      ? [
          facts.confirmation15M.confirmed
            ? `${facts.confirmation15M.pattern}: the pattern has closed and can be evaluated.`
            : `${facts.confirmation15M.pattern}: the current pattern is still forming.`,
        ]
      : [
          "Recent candle history is not available yet. Wait for confirmed price evidence rather than guessing.",
        ];
  const recentPattern =
    facts.patterns.bullish?.score &&
    (!facts.patterns.bearish ||
      facts.patterns.bullish.score >= facts.patterns.bearish.score)
      ? { ...facts.patterns.bullish, direction: "bullish" }
      : facts.patterns.bearish
        ? { ...facts.patterns.bearish, direction: "bearish" }
        : null;
  const pattern = recentPattern
    ? {
        name: recentPattern.name.toUpperCase(),
        meaning:
          recentPattern.direction === "bullish"
            ? "Buyers overcame recent selling pressure."
            : "Sellers overcame recent buying pressure.",
        location: `Detected around the current ${facts.setup1H.location} area.`,
        importance:
          facts.setup1H.location ===
          (recentPattern.direction === "bullish" ? "support" : "resistance")
            ? "Its location supports the pattern, making it more meaningful."
            : "It is away from the ideal level, so it deserves less weight.",
        status:
          recentPattern.status === "confirmed"
            ? "CONFIRMED"
            : "FORMING — wait for candle close",
      }
    : null;
  const rr = facts.riskReward.ratio;
  const riskReward =
    !facts.riskReward.valid || rr === null
      ? {
          label: "Unavailable",
          value: "—",
          meaning: "A valid entry, stop, and target are not available.",
        }
      : rr < 1
        ? {
            label: "Poor",
            value: `1 : ${rr.toFixed(2)}`,
            meaning: "You would risk more than the potential reward.",
          }
        : rr < 1.5
          ? {
              label: "Weak",
              value: `1 : ${rr.toFixed(2)}`,
              meaning:
                "The potential reward is not large enough for a strong new entry.",
            }
          : rr < 2
            ? {
                label: "Acceptable",
                value: `1 : ${rr.toFixed(2)}`,
                meaning: `Potential reward is about ${rr.toFixed(1)} times the planned risk.`,
              }
            : {
                label: "Good",
                value: `1 : ${rr.toFixed(2)}`,
                meaning: `Potential reward is about ${rr.toFixed(1)} times the planned risk.`,
              };
  const signals: CoachSignal[] = [
    {
      tone: bullish || bearish ? "good" : "caution",
      text: `4H direction is ${facts.trend4H.direction}`,
    },
    {
      tone: atResistance || atSupport ? "caution" : middle ? "bad" : "good",
      text: atResistance
        ? "Price is close to resistance"
        : atSupport
          ? "Price is close to support"
          : "Price is in the middle of the range",
    },
    {
      tone: confirmed ? "good" : forming ? "forming" : "bad",
      text: confirmed
        ? "15M confirmation has closed"
        : forming
          ? "15M signal is still forming"
          : "15M confirmation is missing",
    },
    {
      tone:
        riskReward.label === "Good" || riskReward.label === "Acceptable"
          ? "good"
          : "bad",
      text: `Risk/reward is ${riskReward.label.toLowerCase()}`,
    },
  ];
  const bullishEvidence = [
    bullish ? "4H trend favors buyers" : null,
    atSupport ? "Price is near support" : null,
    facts.confirmation15M.direction === "bullish"
      ? `${facts.confirmation15M.pattern ?? "15M evidence"} is bullish`
      : null,
  ].filter((item): item is string => !!item);
  const bearishEvidence = [
    bearish ? "4H trend favors sellers" : null,
    atResistance ? "Price is near resistance" : null,
    facts.confirmation15M.direction === "bearish"
      ? `${facts.confirmation15M.pattern ?? "15M evidence"} is bearish`
      : null,
  ].filter((item): item is string => !!item);
  return {
    view:
      facts.preference === "BUY"
        ? facts.setupScore >= 80
          ? "STRONG BUY"
          : "BUY"
        : facts.preference === "SELL"
          ? facts.setupScore >= 80
            ? "STRONG SELL"
            : "SELL"
          : "WAIT",
    strength: facts.setupQuality,
    marketNow,
    action,
    mainReason,
    buyers,
    sellers,
    controlExplanation:
      facts.buyScore.total > facts.sellScore.total
        ? "Buyers have more calculated evidence, but every required entry condition still matters."
        : facts.sellScore.total > facts.buyScore.total
          ? "Sellers have more calculated evidence, but every required entry condition still matters."
          : "Neither side has a meaningful evidence advantage.",
    flow,
    candleStory,
    candleOverall: forming
      ? "A side may be gaining strength, but the candle must close before that evidence is trusted."
      : confirmed
        ? "The latest detected evidence is confirmed, but location and risk still decide whether it is usable."
        : "Recent candles have not produced a clean entry confirmation.",
    pattern,
    signals,
    conflicts: {
      bullish: bullishEvidence,
      bearish: bearishEvidence,
      conclusion:
        bullishEvidence.length && bearishEvidence.length
          ? "Signals conflict. WAIT until one side confirms control."
          : "Evidence is mostly aligned, subject to confirmation and risk.",
    },
    riskReward,
    location: title(facts.setup1H.location),
  };
}
