import type { Candle, MarketDataProvider, MarketSymbol, ProviderResult, Quote, SymbolSearchResult, Timeframe } from "../types";
import { MarketDataError } from "../types";

const frame: Record<Timeframe, { unit: string; aggregate: number }> = {
  "15m": { unit: "minute", aggregate: 15 }, "1H": { unit: "hour", aggregate: 1 },
  "4H": { unit: "hour", aggregate: 4 }, "1D": { unit: "day", aggregate: 1 },
};
export class DexMarketDataProvider implements MarketDataProvider {
  readonly name = "GeckoTerminal";
  readonly source = "LIVE" as const;
  private requireIdentity(symbol: MarketSymbol) {
    if (!symbol.chainId || !symbol.pairAddress)
      throw new MarketDataError("DEX token identity is incomplete", 400, "DEX_IDENTITY_REQUIRED");
    return { chain: symbol.chainId, pair: symbol.pairAddress };
  }
  async getCandles(symbol: MarketSymbol, timeframe: Timeframe): Promise<ProviderResult<Candle[]>> {
    const { chain, pair } = this.requireIdentity(symbol);
    const interval = frame[timeframe];
    const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(chain)}/pools/${encodeURIComponent(pair)}/ohlcv/${interval.unit}?aggregate=${interval.aggregate}&limit=300`, {
      signal: AbortSignal.timeout(8_000), next: { revalidate: 30 },
    });
    if (!response.ok) throw new MarketDataError(`GeckoTerminal candles returned HTTP ${response.status}`, 502, "DEX_CANDLES_UNAVAILABLE");
    const body = (await response.json()) as { data?: { attributes?: { ohlcv_list?: number[][] } } };
    const data = (body.data?.attributes?.ohlcv_list ?? []).map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume })).filter((bar) => [bar.time, bar.open, bar.high, bar.low, bar.close].every(Number.isFinite)).sort((a, b) => a.time - b.time);
    if (!data.length) throw new MarketDataError("No on-chain candle history is available for this pool", 404, "INSUFFICIENT_HISTORY");
    return { data, source: this.source, provider: this.name, message: data.length < 30 ? "Limited-history analysis" : undefined };
  }
  async getQuote(symbol: MarketSymbol): Promise<ProviderResult<Quote>> {
    const { chain, pair } = this.requireIdentity(symbol);
    const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(chain)}/${encodeURIComponent(pair)}`, { signal: AbortSignal.timeout(8_000), next: { revalidate: 5 } });
    if (!response.ok) throw new MarketDataError("DEX quote unavailable", 502, "DEX_QUOTE_UNAVAILABLE");
    const body = (await response.json()) as { pairs?: { priceUsd?: string; priceChange?: { h24?: number } }[] };
    const pairData = body.pairs?.[0];
    if (!pairData) throw new MarketDataError("DEX pair no longer available", 404, "DEX_PAIR_UNAVAILABLE");
    return { source: this.source, provider: "DEX Screener", data: { symbol: symbol.symbol, price: Number(pairData.priceUsd), change: 0, changePercent: Number(pairData.priceChange?.h24 ?? 0), timestamp: Date.now() } };
  }
  async searchSymbols(): Promise<ProviderResult<SymbolSearchResult[]>> { return { data: [], source: this.source, provider: this.name }; }
}

export const dexMarketDataProvider = new DexMarketDataProvider();
