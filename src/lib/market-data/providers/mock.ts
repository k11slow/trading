import { generateMarketData, marketCatalog } from "../../market-data";
import type { MarketCategory, MarketDataProvider, MarketSymbol, ProviderResult, Quote, SymbolSearchResult, Timeframe } from "../types";

export class MockProvider implements MarketDataProvider {
  readonly name: string; readonly source = "MOCK" as const;
  constructor(private readonly categories: MarketCategory[], label: string) { this.name = label; }
  async getQuote(symbol: MarketSymbol): Promise<ProviderResult<Quote>> { return { source: this.source, provider: this.name, message: "No live provider configured", data: { symbol: symbol.symbol, price: symbol.price, change: symbol.price * symbol.change / 100, changePercent: symbol.change, timestamp: Date.now() } }; }
  async getQuotes(symbols: MarketSymbol[]): Promise<ProviderResult<Quote[]>> { return { source: this.source, provider: this.name, message: "No live provider configured", data: symbols.map((symbol) => ({ symbol: symbol.symbol, price: symbol.price, change: symbol.price * symbol.change / 100, changePercent: symbol.change, timestamp: Date.now() })) }; }
  async getCandles(symbol: MarketSymbol, timeframe: Timeframe) { const generated = generateMarketData(symbol, timeframe); return { source: this.source, provider: this.name, message: "No live provider configured", data: generated.candles.map(({ time, open, high, low, close, volume }) => ({ time: Number(time), open, high, low, close, volume })) }; }
  async searchSymbols(query: string, category: MarketCategory): Promise<ProviderResult<SymbolSearchResult[]>> { const normalized = query.toLowerCase(); const data = this.categories.includes(category) ? marketCatalog[category].filter((item) => item.symbol.toLowerCase().includes(normalized) || item.name.toLowerCase().includes(normalized)).map(({ symbol, name, exchange, category: itemCategory }) => ({ symbol, name, exchange, category: itemCategory })) : []; return { source: this.source, provider: this.name, data }; }
}
