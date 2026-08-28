import type { Candle, MarketDataProvider, MarketSymbol, ProviderResult, Quote, SymbolSearchResult, Timeframe } from "../types";
import { MarketDataError } from "../types";
import { marketCatalog } from "../../market-data";

// Binance recommends its market-data-only host for public quotes and candles.
// The main api.binance.com host can return HTTP 451 from some cloud regions.
const REST_URL = process.env.BINANCE_REST_URL ?? "https://data-api.binance.vision";
const intervals: Record<Timeframe, string> = { "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d" };
const revalidate: Record<Timeframe, number> = { "15m": 30, "1H": 60, "4H": 300, "1D": 900 };
const pair = (symbol: string) => symbol.replace("/", "").toUpperCase();

async function binanceFetch<T>(path: string, init?: RequestInit & { next?: { revalidate: number } }): Promise<T> {
  let response: Response;
  try { response = await fetch(`${REST_URL}${path}`, { ...init, signal: AbortSignal.timeout(8000) }); }
  catch { throw new MarketDataError("Binance is temporarily unreachable", 503, "PROVIDER_UNAVAILABLE"); }
  if (!response.ok) {
    if (response.status === 400) throw new MarketDataError("Data unavailable for this Binance symbol", 404, "SYMBOL_UNAVAILABLE");
    throw new MarketDataError(`Binance returned HTTP ${response.status}`, 502, "PROVIDER_ERROR");
  }
  return response.json() as Promise<T>;
}

type BinanceTicker = { symbol: string; lastPrice: string; priceChange: string; priceChangePercent: string; closeTime: number };
type BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, string];

export class BinanceProvider implements MarketDataProvider {
  readonly name = "Binance"; readonly source = "LIVE" as const;
  async getQuote(symbol: MarketSymbol): Promise<ProviderResult<Quote>> {
    const ticker = await binanceFetch<BinanceTicker>(`/api/v3/ticker/24hr?symbol=${encodeURIComponent(pair(symbol.symbol))}`, { cache: "no-store" });
    return { source: this.source, provider: this.name, data: { symbol: symbol.symbol, price: Number(ticker.lastPrice), change: Number(ticker.priceChange), changePercent: Number(ticker.priceChangePercent), timestamp: ticker.closeTime } };
  }
  async getQuotes(symbols: MarketSymbol[]): Promise<ProviderResult<Quote[]>> { if (!symbols.length) return { source: "LIVE", provider: this.name, data: [] }; const requested = symbols.map((symbol) => pair(symbol.symbol)); const rows = await binanceFetch<BinanceTicker[]>(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(requested))}`, { cache: "no-store" }); const byPair = new Map(symbols.map((symbol) => [pair(symbol.symbol), symbol.symbol])); return { source: "LIVE", provider: this.name, data: rows.map((ticker) => ({ symbol: byPair.get(ticker.symbol) ?? ticker.symbol, price: Number(ticker.lastPrice), change: Number(ticker.priceChange), changePercent: Number(ticker.priceChangePercent), timestamp: ticker.closeTime })) }; }
  async getCandles(symbol: MarketSymbol, timeframe: Timeframe): Promise<ProviderResult<Candle[]>> {
    const rows = await binanceFetch<BinanceKline[]>(`/api/v3/klines?symbol=${encodeURIComponent(pair(symbol.symbol))}&interval=${intervals[timeframe]}&limit=300`, { next: { revalidate: revalidate[timeframe] } });
    const data = rows.map((row) => ({ time: Math.floor(row[0] / 1000), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]) }));
    if (!data.length) throw new MarketDataError("No candle history returned by Binance", 404, "DATA_UNAVAILABLE");
    return { source: this.source, provider: this.name, data };
  }
  async searchSymbols(query: string, category: MarketSymbol["category"]): Promise<ProviderResult<SymbolSearchResult[]>> {
    const normalized = query.toLowerCase();
    const data = marketCatalog[category].filter((item) => item.symbol.toLowerCase().includes(normalized) || item.name.toLowerCase().includes(normalized)).map(({ symbol, name, exchange, category: itemCategory }) => ({ symbol, name, exchange, category: itemCategory }));
    return { source: this.source, provider: this.name, data };
  }
}
