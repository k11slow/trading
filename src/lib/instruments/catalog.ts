import { isMemeAsset } from "./meme-classifier";
import { searchDexScreener } from "./dexscreener";
import { futuresConfigurationMessage, futuresDiscoveryProvider } from "./futures-provider";
import { getDexDiscovery } from "@/lib/markets/geckoterminal";
import type { Instrument, InstrumentCategory } from "./types";
type CacheEntry = { expiresAt: number; value: Instrument[] };
const cache = new Map<string, CacheEntry>();
async function cached(
  key: string,
  ttl: number,
  loader: () => Promise<Instrument[]>,
) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now())
    return { value: hit.value, stale: false };
  try {
    const value = await loader();
    cache.set(key, { expiresAt: Date.now() + ttl, value });
    return { value, stale: false };
  } catch (error) {
    if (hit)
      return {
        value: hit.value,
        stale: true,
        message:
          error instanceof Error ? error.message : "Provider refresh failed",
      };
    throw error;
  }
}
type BinanceSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
  permissions?: string[];
};
async function binanceCatalog() {
  const base = process.env.BINANCE_REST_URL ?? "https://api.binance.com";
  const response = await fetch(`${base}/api/v3/exchangeInfo`, {
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Binance catalog returned HTTP ${response.status}`);
  const body = (await response.json()) as { symbols: BinanceSymbol[] };
  return body.symbols
    .filter(
      (row) =>
        row.status === "TRADING" &&
        (row.isSpotTradingAllowed ?? row.permissions?.includes("SPOT")) &&
        ["USDT", "USDC", "BTC", "ETH", "FDUSD"].includes(row.quoteAsset),
    )
    .map((row): Instrument => {
      const meme = isMemeAsset(row.baseAsset);
      return {
        id: `binance:${row.symbol}`,
        symbol: `${row.baseAsset}/${row.quoteAsset}`,
        baseAsset: row.baseAsset,
        quoteAsset: row.quoteAsset,
        displayName: `${row.baseAsset} / ${row.quoteAsset}`,
        marketCategory: meme ? "Meme Coins" : "Crypto",
        exchange: "BINANCE",
        provider: "Binance",
        assetType: "Spot",
        status: row.status,
        isTradable: true,
        quoteCurrency: row.quoteAsset,
        source: "LIVE",
      };
    });
}
async function twelveForexCatalog() {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error("TWELVE_DATA_API_KEY is not configured");
  const response = await fetch(
    `https://api.twelvedata.com/forex_pairs?apikey=${encodeURIComponent(key)}`,
    { signal: AbortSignal.timeout(8_000), cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(`Twelve Data catalog returned HTTP ${response.status}`);
  const body = (await response.json()) as {
    data?: {
      symbol: string;
      currency_base: string;
      currency_quote: string;
      available_exchanges?: string[];
    }[];
    status?: string;
    message?: string;
  };
  if (body.status === "error")
    throw new Error(body.message ?? "Twelve Data catalog failed");
  return (body.data ?? []).map((row): Instrument => ({
    id: `twelve:${row.symbol}`,
    symbol: row.symbol,
    baseAsset: row.currency_base,
    quoteAsset: row.currency_quote,
    displayName: `${row.currency_base} / ${row.currency_quote}`,
    marketCategory: "Forex",
    exchange: row.available_exchanges?.[0] ?? "TWELVE DATA",
    provider: "Twelve Data",
    assetType: "Currency Pair",
    status: "ACTIVE",
    isTradable: true,
    quoteCurrency: row.currency_quote,
    source: "LIVE",
  }));
}
async function finnhubCatalog() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not configured");
  const response = await fetch(
    `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${encodeURIComponent(key)}`,
    { signal: AbortSignal.timeout(8_000), cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(`Finnhub catalog returned HTTP ${response.status}`);
  const rows = (await response.json()) as {
    symbol: string;
    displaySymbol?: string;
    description?: string;
    type?: string;
  }[];
  return rows
    .filter((row) => row.symbol)
    .map((row): Instrument => {
      const etf = /ETF|ETP|FUND/i.test(row.type ?? "");
      return {
        id: `finnhub:${row.symbol}`,
        symbol: row.symbol,
        baseAsset: row.symbol,
        quoteAsset: "USD",
        displayName: row.description || row.displaySymbol || row.symbol,
        marketCategory: etf ? "ETFs" : "Stocks",
        exchange: "US",
        provider: "Finnhub",
        assetType: row.type || "Equity",
        status: "ACTIVE",
        isTradable: true,
        quoteCurrency: "USD",
        source: "LIVE",
      };
    });
}
const trendingToInstrument = (row: Awaited<ReturnType<typeof getDexDiscovery>>[number]): Instrument => ({
  id: row.id!, symbol: row.symbol, baseAsset: row.symbol.split("/")[0], quoteAsset: "USD",
  displayName: row.name, marketCategory: "Meme Coins", exchange: row.dex ?? "DEX",
  provider: row.provider, assetType: "DEX Token", status: "ACTIVE", isTradable: true,
  quoteCurrency: "USD", source: "LIVE", price: row.price, change24h: row.changePercent,
  volume24h: row.volume, chain: row.chain, chainId: row.chainId, contractAddress: row.contractAddress,
  pairAddress: row.pairAddress, dex: row.dex, liquidity: row.liquidity, fdv: row.fdv,
  marketCap: row.marketCap, pairCreatedAt: row.pairCreatedAt, priceChange5m: row.change5m,
  priceChange1h: row.change1h, priceChange6h: row.change6h, buys24h: row.buys24h,
  sells24h: row.sells24h, riskFlags: row.riskFlags,
});
export async function getCatalog(category: InstrumentCategory) {
  if (category === "Crypto" || category === "Meme Coins") {
    const result = await cached("binance", 60 * 60_000, binanceCatalog);
    if (category === "Meme Coins") {
      const dex = await cached("dex-meme", 60_000, async () =>
        (await getDexDiscovery({ kind: "trending", limit: 120 })).map(trendingToInstrument));
      return { value: [...dex.value, ...result.value.filter((item) => item.marketCategory === category)], stale: dex.stale, provider: "GeckoTerminal + Binance", message: dex.message };
    }
    return {
      ...result,
      value: result.value.filter((item) => item.marketCategory === category),
      provider: "Binance",
    };
  }
  if (category === "Futures") {
    const value = futuresDiscoveryProvider.configured
      ? await futuresDiscoveryProvider.listContracts()
      : [];
    return { value, stale: false, provider: futuresDiscoveryProvider.name, message: value.length ? undefined : futuresConfigurationMessage };
  }
  if (category === "Forex")
    return {
      ...(await cached("twelve-forex", 6 * 60 * 60_000, twelveForexCatalog)),
      provider: "Twelve Data",
    };
  if (category === "Stocks" || category === "ETFs") {
    const result = await cached("finnhub-us", 24 * 60 * 60_000, finnhubCatalog);
    return {
      ...result,
      value: result.value.filter((item) => item.marketCategory === category),
      provider: "Finnhub",
    };
  }
  return {
    value: [],
    stale: false,
    provider: "Not configured",
    message: `${category} discovery provider not configured.`,
  };
}
export async function searchCatalog(
  query: string,
  categories: InstrumentCategory[],
) {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const settled = await Promise.allSettled([
    ...categories.map(getCatalog),
    ...(categories.includes("Meme Coins") || categories.includes("Crypto")
      ? [{ value: await searchDexScreener(query), stale: false, provider: "DEX Screener" }]
      : []),
  ]);
  const results = settled
    .flatMap((result) =>
      result.status === "fulfilled" ? result.value.value : [],
    )
    .filter((item) => {
      const haystack = `${item.symbol} ${item.displayName} ${item.baseAsset} ${item.productCode ?? ""} ${item.exchange}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
  const unique = new Map<string, Instrument>();
  for (const item of results) if (!unique.has(item.id)) unique.set(item.id, item);
  return [...unique.values()].slice(0, 100);
}
