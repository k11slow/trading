import { MarketDataError, type Candle, type MarketDataProvider, type MarketSymbol, type ProviderResult, type Quote, type SymbolSearchResult, type Timeframe } from "../types";

const API = "https://api.massive.com";
const resolutions: Record<Timeframe, string> = { "15m": "15min", "1H": "1hour", "4H": "4hour", "1D": "1session" };
const ttl: Record<Timeframe, number> = { "15m": 30, "1H": 60, "4H": 300, "1D": 900 };
type Bar = { window_start: number; open: number; high: number; low: number; close: number; volume?: number };
type Bars = { status?: string; error?: string; results?: Bar[] };
const key = () => process.env.FUTURES_API_KEY ?? process.env.POLYGON_API_KEY;
async function bars(symbol: string, timeframe: Timeframe, limit: number) {
  const apiKey = key();
  if (!apiKey) throw new MarketDataError("FUTURES_API_KEY is not configured", 503, "PROVIDER_UNAVAILABLE");
  const url = new URL(`/futures/v1/aggs/${encodeURIComponent(symbol)}`, API);
  url.searchParams.set("resolution", resolutions[timeframe]);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "window_start.desc");
  url.searchParams.set("apiKey", apiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), next: { revalidate: ttl[timeframe] } });
  if (!response.ok) throw new MarketDataError(`Massive Futures returned HTTP ${response.status}`, response.status === 403 ? 403 : 502, "FUTURES_DATA_UNAVAILABLE");
  const body = await response.json() as Bars;
  if (body.status === "ERROR") throw new MarketDataError(body.error ?? "Massive Futures request failed", 502, "FUTURES_DATA_UNAVAILABLE");
  return body.results ?? [];
}
export class MassiveFuturesMarketDataProvider implements MarketDataProvider {
  readonly name = "Massive Futures";
  readonly source = "LIVE" as const;
  async getQuote(symbol: MarketSymbol): Promise<ProviderResult<Quote>> {
    const rows = await bars(symbol.symbol, "15m", 2);
    const latest = rows[0]; const previous = rows[1] ?? latest;
    if (!latest) throw new MarketDataError("No recent futures trades for this contract", 404, "FUTURES_QUOTE_UNAVAILABLE");
    const change = latest.close - previous.close;
    return { source: this.source, provider: this.name, data: { symbol: symbol.symbol, price: latest.close, change, changePercent: previous.close ? change / previous.close * 100 : 0, timestamp: Math.floor(latest.window_start / 1_000_000) } };
  }
  async getCandles(symbol: MarketSymbol, timeframe: Timeframe): Promise<ProviderResult<Candle[]>> {
    const rows = await bars(symbol.symbol, timeframe, 300);
    const data = rows.map((row) => ({ time: Math.floor(row.window_start / 1_000_000_000), open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume })).filter((row) => [row.time, row.open, row.high, row.low, row.close].every(Number.isFinite)).sort((a, b) => a.time - b.time);
    if (!data.length) throw new MarketDataError("No futures candle history for this contract", 404, "FUTURES_CANDLES_UNAVAILABLE");
    return { source: this.source, provider: this.name, data };
  }
  async searchSymbols(): Promise<ProviderResult<SymbolSearchResult[]>> { return { source: this.source, provider: this.name, data: [] }; }
}
export const futuresProvider = new MassiveFuturesMarketDataProvider();
