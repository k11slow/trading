import { marketCatalog } from "@/lib/market-data";
import { validateCandles } from "../validation";
import { MarketDataError, type Candle, type MarketDataProvider, type MarketSymbol, type ProviderResult, type Quote, type SymbolSearchResult, type Timeframe } from "../types";

const granularities: Record<Timeframe, string> = { "15m": "M15", "1H": "H1", "4H": "H4", "1D": "D" };
const revalidate: Record<Timeframe, number> = { "15m": 60, "1H": 300, "4H": 900, "1D": 3600 };
const instrumentName = (symbol: string) => symbol.replace("/", "_").toUpperCase();

type OandaCandle = { time: string; volume: number; complete: boolean; mid?: { o: string; h: string; l: string; c: string } };
type OandaPrice = { instrument: string; time: string; status: string; bids?: { price: string }[]; asks?: { price: string }[]; closeoutBid?: string; closeoutAsk?: string };

export class OandaForexProvider implements MarketDataProvider {
  readonly name = "OANDA Practice";
  readonly source = "LIVE" as const;
  private readonly token = process.env.OANDA_API_TOKEN!;
  private readonly accountId = process.env.OANDA_ACCOUNT_ID!;
  private readonly base = process.env.OANDA_ENVIRONMENT === "live" ? "https://api-fxtrade.oanda.com" : "https://api-fxpractice.oanda.com";

  private async request<T>(path: string, cacheSeconds?: number): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(10_000),
        ...(cacheSeconds ? { next: { revalidate: cacheSeconds } } : { cache: "no-store" as const }),
      });
    } catch {
      throw new MarketDataError("OANDA is temporarily unreachable", 503, "PROVIDER_UNAVAILABLE");
    }
    if (!response.ok) {
      const message = response.status === 401 ? "OANDA token or account ID is invalid" : response.status === 404 ? "This instrument is not available in the OANDA practice account" : `OANDA returned HTTP ${response.status}`;
      throw new MarketDataError(message, response.status === 401 ? 401 : 502, response.status === 401 ? "AUTH_ERROR" : "PROVIDER_ERROR");
    }
    return response.json() as Promise<T>;
  }

  async getQuote(symbol: MarketSymbol): Promise<ProviderResult<Quote>> {
    const instrument = instrumentName(symbol.symbol);
    const body = await this.request<{ prices: OandaPrice[] }>(`/v3/accounts/${encodeURIComponent(this.accountId)}/pricing?instruments=${encodeURIComponent(instrument)}`, 10);
    const row = body.prices[0];
    if (!row) throw new MarketDataError("OANDA returned no current price", 404, "DATA_UNAVAILABLE");
    const bid = Number(row.bids?.[0]?.price ?? row.closeoutBid);
    const ask = Number(row.asks?.[0]?.price ?? row.closeoutAsk);
    const price = (bid + ask) / 2;
    if (!Number.isFinite(price)) throw new MarketDataError("OANDA returned an invalid price", 502, "PROVIDER_ERROR");
    return { source: this.source, provider: this.name, data: { symbol: symbol.symbol, price, change: 0, changePercent: 0, timestamp: Date.parse(row.time) } };
  }

  async getQuotes(symbols: MarketSymbol[]): Promise<ProviderResult<Quote[]>> {
    if (!symbols.length) return { source: this.source, provider: this.name, data: [] };
    const names = symbols.map((symbol) => instrumentName(symbol.symbol));
    const body = await this.request<{ prices: OandaPrice[] }>(`/v3/accounts/${encodeURIComponent(this.accountId)}/pricing?instruments=${encodeURIComponent(names.join(","))}`, 10);
    const original = new Map(symbols.map((symbol) => [instrumentName(symbol.symbol), symbol.symbol]));
    const data = body.prices.flatMap((row) => {
      const bid = Number(row.bids?.[0]?.price ?? row.closeoutBid);
      const ask = Number(row.asks?.[0]?.price ?? row.closeoutAsk);
      const price = (bid + ask) / 2;
      return Number.isFinite(price) ? [{ symbol: original.get(row.instrument) ?? row.instrument.replace("_", "/"), price, change: 0, changePercent: 0, timestamp: Date.parse(row.time) }] : [];
    });
    return { source: this.source, provider: this.name, data };
  }

  async getCandles(symbol: MarketSymbol, timeframe: Timeframe): Promise<ProviderResult<Candle[]>> {
    const body = await this.request<{ candles: OandaCandle[] }>(`/v3/instruments/${encodeURIComponent(instrumentName(symbol.symbol))}/candles?price=M&granularity=${granularities[timeframe]}&count=300`, revalidate[timeframe]);
    const raw = body.candles.flatMap((row) => row.mid ? [{ time: Math.floor(Date.parse(row.time) / 1000), open: Number(row.mid.o), high: Number(row.mid.h), low: Number(row.mid.l), close: Number(row.mid.c), volume: row.volume }] : []);
    const data = validateCandles(raw, symbol).candles;
    if (!data.length) throw new MarketDataError("OANDA returned no valid candles", 404, "DATA_UNAVAILABLE");
    return { source: this.source, provider: this.name, data };
  }

  async searchSymbols(query: string): Promise<ProviderResult<SymbolSearchResult[]>> {
    const normalized = query.toLowerCase();
    const data = marketCatalog.Forex.filter((item) => item.symbol.toLowerCase().includes(normalized) || item.name.toLowerCase().includes(normalized)).map(({ symbol, name, exchange, category }) => ({ symbol, name, exchange, category }));
    return { source: this.source, provider: this.name, data };
  }
}
