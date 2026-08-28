import type { MarketRanking, TrendingInstrument } from "./types";

const API = "https://api.geckoterminal.com/api/v2";
const networks = [
  ["solana", "Solana"], ["eth", "Ethereum"], ["base", "Base"],
  ["bsc", "BNB Chain"], ["arbitrum", "Arbitrum"], ["polygon_pos", "Polygon"],
] as const;
type WindowStats = Record<string, string | number>;
type Resource = { id: string; type: string; attributes: Record<string, unknown> };
type Pool = {
  id: string;
  attributes: {
    address: string; name: string; base_token_price_usd?: string;
    pool_created_at?: string; fdv_usd?: string | null; market_cap_usd?: string | null;
    reserve_in_usd?: string; price_change_percentage?: WindowStats;
    volume_usd?: WindowStats; transactions?: Record<string, { buys: number; sells: number }>;
  };
  relationships: { base_token: { data: { id: string } }; dex: { data: { id: string } } };
};
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const normalize = (value: number, ceiling: number) => Math.min(1, Math.log10(Math.max(1, value)) / ceiling);
const score = (pool: Pool) => {
  const a = pool.attributes;
  const transactions = a.transactions?.h24;
  return Math.round(100 * (
    .32 * normalize(number(a.volume_usd?.h24), 8) +
    .28 * normalize(number(a.reserve_in_usd), 7) +
    .2 * normalize((transactions?.buys ?? 0) + (transactions?.sells ?? 0), 5) +
    .12 * Math.min(1, Math.abs(number(a.price_change_percentage?.h1)) / 50) +
    .08 * normalize(number(a.volume_usd?.m5) * 288, 8)
  ));
};
const flagsFor = (created: number, liquidity: number, change: number) => {
  const age = Date.now() - created;
  return [
    ...(liquidity < 10_000 ? ["VERY LOW LIQUIDITY"] : []),
    ...(age < 86_400_000 ? ["NEW TOKEN"] : []),
    ...(Math.abs(change) >= 50 ? ["EXTREME VOLATILITY"] : []),
    ...(age < 14_400_000 ? ["INSUFFICIENT HISTORY"] : []),
  ];
};

async function loadNetwork(network: string, kind: "trending" | "new") {
  const endpoint = kind === "new" ? "new_pools" : "trending_pools";
  const response = await fetch(`${API}/networks/${network}/${endpoint}?include=base_token,dex&page=1`, {
    signal: AbortSignal.timeout(8_000), next: { revalidate: kind === "new" ? 30 : 60 },
  });
  if (!response.ok) throw new Error(`GeckoTerminal ${network} returned HTTP ${response.status}`);
  return response.json() as Promise<{ data: Pool[]; included?: Resource[] }>;
}

export async function getDexDiscovery(options: {
  kind: "trending" | "new"; ranking?: MarketRanking; chain?: string;
  minLiquidity?: number; minVolume?: number; maxAgeMs?: number; limit?: number;
}) {
  const selected = options.chain && options.chain !== "All"
    ? networks.filter(([, label]) => label === options.chain)
    : networks;
  const settled = await Promise.allSettled(selected.map(async ([id, label]) => ({ id, label, body: await loadNetwork(id, options.kind) })));
  const rows: TrendingInstrument[] = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const { id: chainId, label: chain, body } = result.value;
    const included = new Map((body.included ?? []).map((resource) => [resource.id, resource]));
    for (const pool of body.data ?? []) {
      const token = included.get(pool.relationships.base_token.data.id);
      const dex = included.get(pool.relationships.dex.data.id);
      const contract = String(token?.attributes.address ?? pool.relationships.base_token.data.id.replace(`${chainId}_`, ""));
      const symbol = String(token?.attributes.symbol ?? pool.attributes.name.split("/")[0].trim());
      const name = String(token?.attributes.name ?? symbol);
      const created = Date.parse(pool.attributes.pool_created_at ?? "") || 0;
      const liquidity = number(pool.attributes.reserve_in_usd);
      const volume = number(pool.attributes.volume_usd?.h24);
      const change = number(pool.attributes.price_change_percentage?.h24);
      if (liquidity < (options.minLiquidity ?? 0) || volume < (options.minVolume ?? 0)) continue;
      if (options.maxAgeMs && (!created || Date.now() - created > options.maxAgeMs)) continue;
      const transactions = pool.attributes.transactions?.h24;
      rows.push({
        id: `${chainId}:${contract.toLowerCase()}`, symbol: `${symbol}/USD`, name,
        market: "Meme Coins", price: number(pool.attributes.base_token_price_usd),
        changePercent: change, change5m: number(pool.attributes.price_change_percentage?.m5),
        change1h: number(pool.attributes.price_change_percentage?.h1),
        change6h: number(pool.attributes.price_change_percentage?.h6), volume,
        volumeChange: null, volatility: Math.abs(change),
        tradeCount: (transactions?.buys ?? 0) + (transactions?.sells ?? 0),
        buys24h: transactions?.buys ?? 0, sells24h: transactions?.sells ?? 0,
        trendingScore: score(pool), aiSetupScore: null,
        trendDirection: change > .15 ? "Bullish" : change < -.15 ? "Bearish" : "Sideways",
        newsActivity: null, source: "LIVE", provider: "GeckoTerminal", highRisk: true,
        chain, chainId, contractAddress: contract, pairAddress: pool.attributes.address,
        dex: String(dex?.attributes.name ?? dex?.id ?? "DEX"), liquidity,
        fdv: number(pool.attributes.fdv_usd), marketCap: number(pool.attributes.market_cap_usd),
        pairCreatedAt: created, pairAgeMs: created ? Math.max(0, Date.now() - created) : undefined,
        riskFlags: flagsFor(created, liquidity, change),
      });
    }
  }
  const primary = new Map<string, TrendingInstrument>();
  for (const row of rows) {
    const previous = primary.get(row.id!);
    if (!previous || (row.liquidity ?? 0) > (previous.liquidity ?? 0)) primary.set(row.id!, row);
  }
  return [...primary.values()].sort((a, b) =>
    options.kind === "new" || options.ranking === "Newest" ? (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0)
      : options.ranking === "Top Gainers" ? b.changePercent - a.changePercent
        : options.ranking === "Top Losers" ? a.changePercent - b.changePercent
          : options.ranking === "Most Active" ? b.volume - a.volume
            : options.ranking === "Most Liquid" ? (b.liquidity ?? 0) - (a.liquidity ?? 0)
              : b.trendingScore - a.trendingScore
  ).slice(0, options.limit ?? 100);
}

export const supportedDexChains = networks.map(([, label]) => label);
