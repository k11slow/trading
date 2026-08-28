import type { Candle, Timeframe } from "@/lib/market-data/types";

export type SwingSensitivity = "low" | "medium" | "high";
export type SwingPoint = { index: number; time: number; price: number; type: "high" | "low"; confirmed: true; prominence: number };
export type StructureLabelKind = "HH" | "HL" | "LH" | "LL";
export type StructureLabel = SwingPoint & { label: StructureLabelKind; previousPrice: number };
export type TrendDirection = "bullish" | "bearish" | "sideways";
export type TrendAnalysis = { trend: TrendDirection; confidence: number; bullishSignals: number; bearishSignals: number };
export type ZoneType = "support" | "resistance";
export type SupportResistanceZone = { id: string; type: ZoneType; low: number; high: number; midpoint: number; strength: number; touches: number; lastTouchedAt: number };
export type RoleReversal = { zoneId: string; originalType: ZoneType; newType: ZoneType; brokenAt: number; retestedAt: number; label: "Old Support → New Resistance" | "Old Resistance → New Support" };
export type AnalysisOptions = { sensitivity?: SwingSensitivity; breakoutTolerance?: number; maxZonesPerType?: number };
export type TimeframeStructureAnalysis = {
  timeframe: Timeframe; swings: SwingPoint[]; labels: StructureLabel[]; trend: TrendAnalysis;
  zones: SupportResistanceZone[]; roleReversals: RoleReversal[]; latestStructure: string; analyzedThrough: number | null;
};
export type MultiTimeframeStructureAnalysis = {
  symbol: string; generatedAt: number; byTimeframe: Partial<Record<Timeframe, TimeframeStructureAnalysis>>;
};
export type CandleSeries = Candle[];
