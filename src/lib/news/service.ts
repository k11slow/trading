import { findAsset } from "@/lib/market-data";
import type { MarketCategory } from "@/lib/market-data/types";
import { deduplicateNews } from "./dedupe";
import { FinnhubNewsProvider } from "./providers/finnhub";
import { assessNewsRisk } from "./risk";
import type { CalendarFilters, EconomicEvent, NewsArticle, NewsProviderResult, SymbolNewsContext } from "./types";

const provider = new FinnhubNewsProvider();
const unavailable = <T>(data: T, message: string): NewsProviderResult<T> => ({ data, source: "UNAVAILABLE", provider: provider.name, message });
export async function getMarketNews(category: MarketCategory, symbol?: string) {
  try { const result = await provider.getNews(category, symbol); return { ...result, data: deduplicateNews(result.data) }; }
  catch (error) { return unavailable<NewsArticle[]>([], error instanceof Error ? error.message : "News provider unavailable"); }
}
export async function getEconomicCalendar(filters: CalendarFilters = {}) {
  const from = new Date(filters.from ?? Date.now() - 6 * 3_600_000); const to = new Date(filters.to ?? Date.now() + 7 * 86_400_000);
  try { const result = await provider.getCalendar(from, to); return { ...result, data: result.data.filter((event) => (!filters.impacts?.length || filters.impacts.includes(event.impact)) && (!filters.currencies?.length || filters.currencies.includes(event.currency))) }; }
  catch (error) { return unavailable<EconomicEvent[]>([], error instanceof Error ? error.message : "Calendar provider unavailable"); }
}
export async function getSymbolNewsContext(symbol: string, category: MarketCategory): Promise<SymbolNewsContext> {
  const asset = findAsset(symbol); const [news, calendar] = await Promise.all([getMarketNews(category, symbol), getEconomicCalendar()]); const available = news.source === "LIVE" && calendar.source === "LIVE";
  const risk = assessNewsRisk(asset, calendar.data, news.data, Date.now(), available); const sources = [news.source, calendar.source];
  return { symbol, category, risk, events: risk.upcomingEvents, articles: risk.relevantBreakingNews, source: sources.every((source) => source === "LIVE") ? "LIVE" : "UNAVAILABLE", provider: provider.name, message: [news.message, calendar.message].filter(Boolean).join(" · ") || undefined };
}
