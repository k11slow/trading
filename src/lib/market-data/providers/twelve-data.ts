import { marketCatalog } from "@/lib/market-data";
import { validateCandles } from "../validation";
import { MarketDataError, type Candle, type MarketDataProvider, type MarketSymbol, type ProviderResult, type Quote, type SymbolSearchResult, type Timeframe } from "../types";

const BASE = "https://api.twelvedata.com"; const intervals: Record<Timeframe, string> = { "15m": "15min", "1H": "1h", "4H": "4h", "1D": "1day" }; const revalidate: Record<Timeframe, number> = { "15m": 30, "1H": 60, "4H": 300, "1D": 900 };
type TwelveError = { status?: string; message?: string; code?: number };
async function request<T>(path: string, cache?: number): Promise<T> { const key = process.env.TWELVE_DATA_API_KEY; if (!key) throw new MarketDataError("TWELVE_DATA_API_KEY is not configured; forex remains mock", 503, "PROVIDER_UNAVAILABLE"); let response: Response; try { response = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(10_000), ...(cache ? { next: { revalidate: cache } } : { cache: "no-store" as const }) }); } catch { throw new MarketDataError("Twelve Data is temporarily unreachable", 503, "PROVIDER_UNAVAILABLE"); } if (!response.ok) throw new MarketDataError(response.status === 429 ? "Twelve Data rate limit reached; retrying automatically" : `Twelve Data returned HTTP ${response.status}`, response.status === 429 ? 429 : 502, response.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR"); const body = await response.json() as T & TwelveError; if (body.status === "error") throw new MarketDataError(body.message ?? "Twelve Data request failed", body.code === 429 ? 429 : 502, body.code === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR"); return body; }
export class TwelveDataForexProvider implements MarketDataProvider {
  readonly name = "Twelve Data"; readonly source = "LIVE" as const;
  async getQuote(symbol: MarketSymbol): Promise<ProviderResult<Quote>> {
    try {
      const row = await request<{ close: string; change: string; percent_change: string; timestamp?: number }>(`/quote?symbol=${encodeURIComponent(symbol.symbol)}`, 15);
      return { source: "LIVE", provider: this.name, data: { symbol: symbol.symbol, price: Number(row.close), change: Number(row.change), changePercent: Number(row.percent_change), timestamp: (row.timestamp ?? Math.floor(Date.now() / 1000)) * 1000 } };
    } catch (quoteError) {
      try {
        const candles = (await this.getCandles(symbol, "15m")).data;
        const latest = candles.at(-1)!;
        const previous = candles.at(-2) ?? latest;
        const change = latest.close - previous.close;
        return {
          source: "LIVE",
          provider: `${this.name} • candle close`,
          message: "Quote endpoint unavailable; using the latest cached live candle close",
          data: {
            symbol: symbol.symbol,
            price: latest.close,
            change,
            changePercent: previous.close ? (change / previous.close) * 100 : 0,
            timestamp: latest.time * 1000,
          },
        };
      } catch {
        throw quoteError;
      }
    }
  }
  async getCandles(symbol: MarketSymbol, timeframe: Timeframe): Promise<ProviderResult<Candle[]>> { const body = await request<{ values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[] }>(`/time_series?symbol=${encodeURIComponent(symbol.symbol)}&interval=${intervals[timeframe]}&outputsize=300&timezone=UTC&order=ASC`, revalidate[timeframe]); const raw = (body.values ?? []).map((row) => ({ time: Math.floor(Date.parse(`${row.datetime.replace(" ", "T")}Z`) / 1000), open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close), volume: row.volume ? Number(row.volume) : undefined })); const data = validateCandles(raw, symbol).candles; if (!data.length) throw new MarketDataError("No valid forex candles returned by Twelve Data", 404, "DATA_UNAVAILABLE"); return { source: "LIVE", provider: this.name, data }; }
  async searchSymbols(query: string): Promise<ProviderResult<SymbolSearchResult[]>> { const normalized = query.toLowerCase(); return { source: "LIVE", provider: this.name, data: marketCatalog.Forex.filter((item) => item.symbol.toLowerCase().includes(normalized) || item.name.toLowerCase().includes(normalized)).map(({ symbol, name, exchange, category }) => ({ symbol, name, exchange, category })) }; }
}
