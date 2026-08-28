export const marketCategories = ["Forex", "Stocks", "Futures", "Crypto", "Meme Coins"] as const;
export type MarketCategory = (typeof marketCategories)[number];
export type Timeframe = "15m" | "1H" | "4H" | "1D";
export type DataSourceKind = "LIVE" | "MOCK" | "UNAVAILABLE";

export type MarketSymbol = {
  symbol: string; name: string; exchange: string; category: MarketCategory;
  price: number; change: number; decimals: number; volatility: number;
  dataStatus?: DataSourceKind;
  chain?: string; chainId?: string; contractAddress?: string; pairAddress?: string;
  provider?: string; dex?: string; liquidity?: number; pairCreatedAt?: number;
  insufficientHistory?: boolean;
  productCode?: string; expiry?: string; contractMonth?: string;
  futuresCategory?: string; continuous?: boolean;
};

export type Quote = {
  symbol: string; price: number; change: number; changePercent: number; timestamp: number;
};

export type Candle = {
  time: number; open: number; high: number; low: number; close: number; volume?: number;
};

export type SymbolSearchResult = Pick<MarketSymbol, "symbol" | "name" | "category" | "exchange">;
export type ProviderResult<T> = { data: T; source: DataSourceKind; provider: string; message?: string };
export type MarketApiResponse<T> = { ok: boolean; data: T | null; source: DataSourceKind; provider: string; message?: string };

export interface MarketDataProvider {
  readonly name: string;
  readonly source: DataSourceKind;
  getQuote(symbol: MarketSymbol): Promise<ProviderResult<Quote>>;
  getQuotes?(symbols: MarketSymbol[]): Promise<ProviderResult<Quote[]>>;
  getCandles(symbol: MarketSymbol, timeframe: Timeframe): Promise<ProviderResult<Candle[]>>;
  searchSymbols(query: string, category: MarketCategory): Promise<ProviderResult<SymbolSearchResult[]>>;
}

export class MarketDataError extends Error {
  constructor(message: string, public readonly status = 502, public readonly code = "PROVIDER_ERROR") { super(message); }
}
