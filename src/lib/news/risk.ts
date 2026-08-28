import type { MarketSymbol } from "@/lib/market-data/types";
import { articleRelevance, eventRelevance } from "./relevance";
import type { EconomicEvent, NewsArticle, NewsImpact, NewsRiskAssessment, RelevantEconomicEvent, RelevantNewsArticle } from "./types";

export const warningWindows = { high: { beforeMinutes: 60, afterMinutes: 30 }, medium: { beforeMinutes: 30, afterMinutes: 15 }, low: { beforeMinutes: 0, afterMinutes: 0 } } as const;
const impactWeight: Record<NewsImpact, number> = { high: 75, medium: 42, low: 10 };
const sensitivity = (symbol: string) => symbol === "TRUMP/USDT" ? 1.2 : ["GOLD", "USOIL"].includes(symbol) ? 1.1 : symbol.endsWith("/USDT") ? 1.05 : 1;
function eventTimeWeight(event: EconomicEvent, now: number) { const minutes = (event.timestamp - now) / 60_000; const window = warningWindows[event.impact]; if (minutes >= 0 && minutes <= window.beforeMinutes) return 1; if (minutes < 0 && minutes >= -window.afterMinutes) return 1; if (minutes <= 360 && minutes >= 0) return .45; if (minutes <= 1_440 && minutes >= 0) return .2; return .04; }
function articleTimeWeight(article: NewsArticle, now: number) { const minutes = Math.max(0, (now - article.publishedAt) / 60_000); return minutes <= 30 ? 1 : minutes <= 120 ? .75 : minutes <= 360 ? .4 : minutes <= 1_440 ? .15 : .04; }
const minutesText = (minutes: number) => minutes < 0 ? `${Math.abs(minutes)}m after release` : minutes < 60 ? `in ${minutes}m` : `in ${Math.round(minutes / 60)}h`;

export function assessNewsRisk(asset: MarketSymbol, events: EconomicEvent[], articles: NewsArticle[], now = Date.now(), available = true): NewsRiskAssessment {
  if (!available) return { score: 0, label: "unavailable", reasons: ["News context is temporarily unavailable; technical analysis continues without a news penalty"], assessedAt: now, upcomingEvents: [], relevantBreakingNews: [], technicalPenalty: 0, nextMajorEvent: null };
  const relevantEvents: RelevantEconomicEvent[] = events.map((event) => ({ ...event, ...(() => { const result = eventRelevance(asset, event); return { relevance: result.score, relevanceReason: result.reason }; })() })).filter((event) => event.relevance >= .25 && event.timestamp >= now - 6 * 3_600_000).sort((a, b) => a.timestamp - b.timestamp);
  const relevantNews: RelevantNewsArticle[] = articles.map((article) => ({ ...article, ...(() => { const result = articleRelevance(asset, article); return { relevance: result.score, relevanceReason: result.reason }; })() })).filter((article) => article.relevance >= .25 && article.publishedAt >= now - 48 * 3_600_000).sort((a, b) => b.publishedAt - a.publishedAt);
  const eventScores = relevantEvents.map((event) => impactWeight[event.impact] * event.relevance * eventTimeWeight(event, now));
  const newsScores = relevantNews.map((article) => impactWeight[article.impact] * article.relevance * article.sourceQuality * articleTimeWeight(article, now));
  const scores = [...eventScores, ...newsScores].sort((a, b) => b - a); const score = Math.min(100, Math.round(((scores[0] ?? 0) + (scores[1] ?? 0) * .25 + (scores[2] ?? 0) * .1) * sensitivity(asset.symbol)));
  const label = score >= 61 ? "high" : score >= 31 ? "medium" : "low"; const reasons: string[] = [];
  const topEvent = relevantEvents[0]; if (topEvent) reasons.push(`${topEvent.title} ${minutesText(Math.round((topEvent.timestamp - now) / 60_000))} · ${topEvent.relevanceReason}`);
  const topNews = relevantNews[0]; if (topNews && newsScores[0] >= 15) reasons.push(`${topNews.impact} impact headline from ${topNews.source} · ${topNews.relevanceReason}; direction uncertain`);
  if (!reasons.length) reasons.push("No major relevant events or breaking headlines are close");
  return { score, label, reasons, assessedAt: now, upcomingEvents: relevantEvents.slice(0, 12), relevantBreakingNews: relevantNews.slice(0, 12), technicalPenalty: label === "high" ? 20 : label === "medium" ? 8 : 0, nextMajorEvent: relevantEvents.find((event) => event.impact === "high") ?? relevantEvents[0] ?? null };
}
