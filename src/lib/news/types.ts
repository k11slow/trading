import type { DataSourceKind, MarketCategory } from "@/lib/market-data/types";

export type NewsImpact = "low" | "medium" | "high";
export type NewsRiskLabel = NewsImpact | "unavailable";
export type EconomicEventStatus = "upcoming" | "live" | "released";

export type EconomicEvent = {
  id: string; title: string; country: string; currency: string; timestamp: number;
  impact: NewsImpact; actual?: string; forecast?: string; previous?: string;
  status: EconomicEventStatus; source: string;
};

export type NewsArticle = {
  id: string; headline: string; source: string; publishedAt: number; url?: string;
  category: string; relatedSymbols: string[]; relatedCurrencies: string[];
  impact: NewsImpact; sourceQuality: number; direction: "uncertain";
};

export type RelevantEconomicEvent = EconomicEvent & { relevance: number; relevanceReason: string };
export type RelevantNewsArticle = NewsArticle & { relevance: number; relevanceReason: string };

export type NewsRiskAssessment = {
  score: number; label: NewsRiskLabel; reasons: string[]; assessedAt: number;
  upcomingEvents: RelevantEconomicEvent[]; relevantBreakingNews: RelevantNewsArticle[];
  technicalPenalty: number; nextMajorEvent: RelevantEconomicEvent | null;
};

export type SymbolNewsContext = {
  symbol: string; category: MarketCategory; risk: NewsRiskAssessment;
  events: RelevantEconomicEvent[]; articles: RelevantNewsArticle[];
  source: DataSourceKind; provider: string; message?: string;
};

export type NewsProviderResult<T> = { data: T; source: DataSourceKind; provider: string; message?: string };
export interface NewsProvider {
  readonly name: string;
  getNews(category: MarketCategory, symbol?: string): Promise<NewsProviderResult<NewsArticle[]>>;
  getCalendar(from: Date, to: Date): Promise<NewsProviderResult<EconomicEvent[]>>;
}

export type CalendarFilters = { impacts?: NewsImpact[]; currencies?: string[]; from?: number; to?: number };
export type NewsAlertPreferences = { highImpact60m: boolean; highImpact30m: boolean; breakingHighImpact: boolean };
