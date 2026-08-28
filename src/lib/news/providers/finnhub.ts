import type { MarketCategory } from "@/lib/market-data/types";
import type { EconomicEvent, NewsArticle, NewsImpact, NewsProvider, NewsProviderResult } from "../types";

const BASE_URL = "https://finnhub.io/api/v1";
type FinnhubNews = { id?: number; category?: string; datetime?: number; headline?: string; related?: string; source?: string; summary?: string; url?: string };
type FinnhubEvent = { actual?: string | number; country?: string; estimate?: string | number; event?: string; impact?: string | number; prev?: string | number; time?: string; unit?: string };
const quality = (source: string) => /reuters|bloomberg/i.test(source) ? .98 : /federal reserve|ecb|bank of england|bank of japan|government|statistics|sec|company|exchange/i.test(source) ? .95 : /cnbc|financial times|wall street journal|marketwatch|associated press/i.test(source) ? .82 : .58;
const severity = (text: string): NewsImpact => /emergency|attack|war|sanction|tariff|hack|outage|rate decision|cpi|inflation|payroll|bankruptcy|halt/i.test(text) ? "high" : /fed|ecb|earnings|guidance|regulation|etf|oil supply|jobs|gdp/i.test(text) ? "medium" : "low";
const currencyFor = (country: string, title: string) => {
  const value = `${country} ${title}`.toLowerCase();
  if (/united states|\bus\b|federal reserve|fed|powell/.test(value)) return "USD";
  if (/euro|ecb|germany|france|italy|spain/.test(value)) return "EUR";
  if (/united kingdom|\buk\b|bank of england|boe/.test(value)) return "GBP";
  if (/japan|bank of japan|boj/.test(value)) return "JPY";
  return country.toUpperCase().slice(0, 3);
};
const eventImpact = (value: string | number | undefined): NewsImpact => { const text = String(value ?? "").toLowerCase(); const numeric = Number(value); return text === "high" || numeric >= 3 ? "high" : text === "medium" || numeric === 2 ? "medium" : "low"; };
const eventStatus = (timestamp: number, actual?: unknown): EconomicEvent["status"] => actual !== undefined && actual !== null && actual !== "" ? "released" : Math.abs(timestamp - Date.now()) <= 5 * 60_000 ? "live" : timestamp > Date.now() ? "upcoming" : "released";

export class FinnhubNewsProvider implements NewsProvider {
  readonly name = "Finnhub";
  private get apiKey() { return process.env.FINNHUB_API_KEY; }
  private async request<T>(path: string, revalidate: number): Promise<T> {
    if (!this.apiKey) throw new Error("FINNHUB_API_KEY is not configured");
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${BASE_URL}${path}`, { headers: { "X-Finnhub-Token": this.apiKey }, signal: controller.signal, next: { revalidate } });
      if (!response.ok) throw new Error(`Finnhub returned HTTP ${response.status}`); const body = await response.json();
      if (body && typeof body === "object" && !Array.isArray(body) && "error" in body) throw new Error(String((body as { error: unknown }).error));
      return body as T;
    } finally { clearTimeout(timeout); }
  }
  async getNews(category: MarketCategory, symbol?: string): Promise<NewsProviderResult<NewsArticle[]>> {
    const endpoint = category === "Stocks" && symbol ? `/company-news?symbol=${encodeURIComponent(symbol)}&from=${new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}` : `/news?category=${category === "Forex" ? "forex" : category === "Crypto" || category === "Meme Coins" ? "crypto" : "general"}`;
    const rows = await this.request<FinnhubNews[]>(endpoint, 300);
    const data = (Array.isArray(rows) ? rows : []).filter((row) => row.headline && row.datetime).map((row): NewsArticle => {
      const headline = row.headline!; const source = row.source || "Finnhub feed"; const text = `${headline} ${row.summary ?? ""}`;
      const currencies = [...new Set([...text.matchAll(/\b(USD|EUR|GBP|JPY)\b/gi)].map((match) => match[1].toUpperCase()))];
      const relatedSymbols = (row.related ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      return { id: String(row.id ?? `${row.datetime}-${headline}`), headline, source, publishedAt: row.datetime! * 1000, url: row.url || undefined, category: row.category || category, relatedSymbols, relatedCurrencies: currencies, impact: severity(text), sourceQuality: quality(source), direction: "uncertain" };
    });
    return { data, source: "LIVE", provider: this.name };
  }
  async getCalendar(from: Date, to: Date): Promise<NewsProviderResult<EconomicEvent[]>> {
    const rows = await this.request<{ economicCalendar?: FinnhubEvent[] }>(`/calendar/economic?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`, 900);
    const data = (rows.economicCalendar ?? []).filter((row) => row.event && row.time).map((row): EconomicEvent => {
      const timestamp = Date.parse(row.time!); const country = row.country || ""; const title = row.event!;
      const display = (value: string | number | undefined) => value === undefined || value === null || value === "" ? undefined : `${value}${row.unit ?? ""}`;
      return { id: `${timestamp}-${country}-${title}`, title, country, currency: currencyFor(country, title), timestamp, impact: eventImpact(row.impact), actual: display(row.actual), forecast: display(row.estimate), previous: display(row.prev), status: eventStatus(timestamp, row.actual), source: this.name };
    }).filter((event) => Number.isFinite(event.timestamp));
    return { data, source: "LIVE", provider: this.name };
  }
}
