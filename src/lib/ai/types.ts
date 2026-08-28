import type { MarketCategory } from "@/lib/market-data/types";
import type { NewsRiskAssessment } from "@/lib/news";

export type TradingPreference = "BUY" | "WAIT" | "SELL";
export type ExplanationMode = "beginner" | "standard" | "advanced";
export type SetupLocation = "support" | "resistance" | "middle" | "breakout" | "retest";
export type PriceZoneFact = { low: number; high: number; midpoint: number; strength: number; touches: number };
export type SetupScoreComponents = { trend4H: number; location1H: number; confirmation15M: number; patternQuality: number; riskReward: number; marketClarity: number };
export type ScoreComponentDetail = { category: string; pointsAwarded: number; maxPoints: number; reason: string };
export type DirectionalScore = { total: number; components: SetupScoreComponents; breakdown: ScoreComponentDetail[] };
export type SetupQuality = "Weak" | "Developing" | "Moderate" | "Good" | "Strong" | "Very Strong";
export type RuleBasedSetup = {
  symbol: string; category: MarketCategory; price: number; calculatedAt: number; stateKey: string;
  trend4H: { direction: "bullish" | "bearish" | "sideways"; confidence: number; structure: string[] };
  setup1H: { location: SetupLocation; structure: string; support: PriceZoneFact | null; resistance: PriceZoneFact | null; roleReversal: string | null };
  confirmation15M: { direction: "bullish" | "bearish" | "neutral" | "none"; confirmed: boolean; forming: boolean; pattern: string | null; score: number };
  patterns: { bullish: { name: string; score: number; status: "confirmed" | "forming" } | null; bearish: { name: string; score: number; status: "confirmed" | "forming" } | null };
  riskReward: { direction: "buy" | "sell" | "none"; entry: number; stop: number | null; target: number | null; ratio: number | null; valid: boolean; reason: string };
  buyScore: DirectionalScore; sellScore: DirectionalScore; technicalPreference: TradingPreference; technicalSetupScore: number; preference: TradingPreference; setupScore: number; setupQuality: SetupQuality; confidenceLabel: "Strong setup" | "Good setup" | "Weak / caution" | "Wait";
  newsRisk: Pick<NewsRiskAssessment, "score" | "label" | "reasons" | "technicalPenalty"> & { upcomingEvent: { id: string; title: string; timestamp: number; impact: string } | null; relevantHeadlineIds: string[] };
  ruleReasons: string[]; ruleWarnings: string[]; buyConditions: string[]; sellConditions: string[]; invalidationFacts: string[]; watchFacts: string[];
};
export type TradingAssistantExplanation = {
  preference: TradingPreference; setupScore: number; confidenceLabel: RuleBasedSetup["confidenceLabel"];
  summary: string; reasons: string[]; warnings: string[]; whatWouldInvalidate: string[]; whatToWatchNext: string[];
};
export type TradingAssistantResult = { analysis: TradingAssistantExplanation; source: "openai" | "rule-based"; model: string | null; generatedAt: number; cached: boolean; message?: string };
export type AIHistoryEntry = Pick<RuleBasedSetup, "symbol" | "price" | "preference" | "setupScore" | "technicalPreference" | "technicalSetupScore" | "newsRisk"> & { timestamp: number; reasons: string[]; support: PriceZoneFact | null; resistance: PriceZoneFact | null; entry: number; stop: number | null; target: number | null };
