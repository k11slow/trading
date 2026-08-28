import type { Instrument } from "./types";

const API = "https://api.dexscreener.com";
const supportedChains = new Map([
  ["solana", "Solana"], ["ethereum", "Ethereum"], ["base", "Base"],
  ["bsc", "BNB Chain"], ["arbitrum", "Arbitrum"], ["polygon", "Polygon"],
]);

type DexPair = {
  chainId: string; dexId: string; pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string | null; liquidity?: { usd?: number }; fdv?: number; marketCap?: number;
  pairCreatedAt?: number; volume?: Record<string, number>; priceChange?: Record<string, number>;
  txns?: Record<string, { buys: number; sells: number }>;
};

const finite = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const riskFlags = (pair: DexPair) => {
  const flags: string[] = [];
  const age = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : Infinity;
  if (finite(pair.liquidity?.usd) < 10_000) flags.push("VERY LOW LIQUIDITY");
  if (age < 24 * 60 * 60_000) flags.push("NEW TOKEN");
  if (Math.abs(finite(pair.priceChange?.h24)) >= 50) flags.push("EXTREME VOLATILITY");
  if (age < 4 * 60 * 60_000) flags.push("INSUFFICIENT HISTORY");
  return flags;
};
export function normalizeDexPair(pair: DexPair): Instrument | null {
  const chain = supportedChains.get(pair.chainId) ?? pair.chainId.split(/[-_]/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
  if (!pair.chainId || !pair.baseToken?.address || !pair.pairAddress) return null;
  return {
    id: `${pair.chainId}:${pair.baseToken.address.toLowerCase()}`,
    symbol: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
    baseAsset: pair.baseToken.symbol,
    quoteAsset: pair.quoteToken.symbol,
    displayName: pair.baseToken.name || pair.baseToken.symbol,
    marketCategory: "Meme Coins",
    exchange: pair.dexId,
    provider: "DEX Screener",
    assetType: "DEX Token",
    status: "ACTIVE",
    isTradable: true,
    quoteCurrency: pair.quoteToken.symbol,
    source: "LIVE",
    price: finite(pair.priceUsd), change24h: finite(pair.priceChange?.h24),
    volume24h: finite(pair.volume?.h24), chain, chainId: pair.chainId,
    contractAddress: pair.baseToken.address, pairAddress: pair.pairAddress,
    dex: pair.dexId, liquidity: finite(pair.liquidity?.usd), fdv: finite(pair.fdv),
    marketCap: finite(pair.marketCap), pairCreatedAt: pair.pairCreatedAt,
    priceChange5m: finite(pair.priceChange?.m5), priceChange1h: finite(pair.priceChange?.h1),
    priceChange6h: finite(pair.priceChange?.h6), buys24h: finite(pair.txns?.h24?.buys),
    sells24h: finite(pair.txns?.h24?.sells), riskFlags: riskFlags(pair),
  };
}

export async function searchDexScreener(query: string) {
  if (query.trim().length < 2) return [];
  const response = await fetch(`${API}/latest/dex/search?q=${encodeURIComponent(query.trim())}`, {
    signal: AbortSignal.timeout(8_000), next: { revalidate: 30 },
  });
  if (!response.ok) throw new Error(`DEX Screener search returned HTTP ${response.status}`);
  const body = (await response.json()) as { pairs?: DexPair[] };
  const candidates = (body.pairs ?? []).map(normalizeDexPair).filter((item): item is Instrument => !!item);
  const primary = new Map<string, Instrument>();
  for (const item of candidates) {
    const existing = primary.get(item.id);
    if (!existing || (item.liquidity ?? 0) > (existing.liquidity ?? 0)) primary.set(item.id, item);
  }
  return [...primary.values()].sort((a, b) => (b.liquidity ?? 0) - (a.liquidity ?? 0)).slice(0, 50);
}

export const dexSupportedChains = [...supportedChains.values()];
