"use client";
/* eslint-disable react-hooks/incompatible-library -- virtualization requires imperative measurement functions. */
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RefreshCw, Search, ShieldAlert, Sparkles, Star, X } from "lucide-react";
import type { RuleBasedSetup } from "@/lib/ai";
import type { MarketScanResult } from "@/lib/ai/market-scanner";
import type { Instrument, InstrumentCategory, ProviderCapability } from "@/lib/instruments/types";
import {
  findAsset,
  type MarketAsset,
  type MarketCategory,
} from "@/lib/market-data";
import type { MarketRanking, TrendingInstrument } from "@/lib/markets/types";
const tabs = [
  "Trending",
  "All",
  "Forex",
  "Stocks",
  "Indices",
  "ETFs",
  "Futures",
  "Commodities",
  "Crypto",
  "Meme Coins",
  "Top Gainers",
  "Top Losers",
  "Most Active",
] as const;
type View = (typeof tabs)[number];
const categoryViews = new Set<InstrumentCategory>([
  "Forex",
  "Stocks",
  "Indices",
  "ETFs",
  "Futures",
  "Commodities",
  "Crypto",
  "Meme Coins",
]);
const fetchJson = async <T,>(url: string, signal?: AbortSignal) => {
  const response = await fetch(url, { signal });
  const body = (await response.json()) as T & { ok: boolean; message?: string };
  if (!response.ok || !body.ok)
    throw new Error(body.message ?? "Market data unavailable");
  return body;
};
const toAsset = (item: Instrument): MarketAsset => {
  const known = findAsset(item.symbol);
  if (known.symbol === item.symbol) return known;
  const category: MarketCategory =
    item.marketCategory === "Crypto" ||
    item.marketCategory === "Meme Coins" ||
    item.marketCategory === "Forex"
      ? item.marketCategory
      : item.marketCategory === "Stocks" || item.marketCategory === "ETFs"
        ? "Stocks"
        : "Futures";
  return {
    symbol: item.symbol,
    name: item.displayName,
    exchange: item.exchange,
    category,
    price: item.price ?? 1,
    change: item.change24h ?? 0,
    decimals: category === "Forex" ? (item.symbol.endsWith("JPY") ? 3 : 5) : 8,
    volatility: category === "Forex" ? 0.0015 : 0.03,
    dataStatus: item.source === "LIVE" ? "LIVE" : "UNAVAILABLE",
    chain: item.chain,
    chainId: item.chainId,
    contractAddress: item.contractAddress,
    pairAddress: item.pairAddress,
    provider: item.provider,
    dex: item.dex,
    liquidity: item.liquidity,
    pairCreatedAt: item.pairCreatedAt,
    insufficientHistory: item.riskFlags?.includes("INSUFFICIENT HISTORY"),
    productCode: item.productCode,
    expiry: item.expiry,
    contractMonth: item.contractMonth,
    futuresCategory: item.futuresCategory,
    continuous: item.continuous,
  };
};
function useDebouncedValue(value: string, delay = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}
export function MarketsWorkspace({
  currentFacts,
  favorites,
  onSelect,
  onToggleFavorite,
  onClose,
}: {
  currentFacts: RuleBasedSetup | null;
  favorites: MarketAsset[];
  onSelect: (asset: MarketAsset) => void;
  onToggleFavorite: (asset: MarketAsset) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>("Trending");
  const [search, setSearch] = useState("");
  const [memeChain, setMemeChain] = useState("All");
  const [minimumLiquidity, setMinimumLiquidity] = useState(10_000);
  const [newAge, setNewAge] = useState(24 * 60 * 60_000);
  const marketScan = useQuery({
    queryKey: ["all-market-ai-scan"],
    staleTime: 60_000,
    queryFn: ({ signal }) => fetchJson<{ ok: boolean; data: MarketScanResult }>("/api/ai/scan", signal),
  });
  const deferredSearch = useDebouncedValue(search.trim());
  const searchQuery = useQuery({
    queryKey: ["instrument-search", deferredSearch],
    enabled: deferredSearch.length >= 2,
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) =>
      fetchJson<{ ok: boolean; instruments: Instrument[] }>(
        `/api/markets/catalog?q=${encodeURIComponent(deferredSearch)}`,
        signal,
      ),
  });
  const ranking: MarketRanking =
    view === "Top Gainers" || view === "Top Losers" || view === "Most Active"
      ? view
      : "Trending";
  const crypto = useQuery({
    queryKey: ["trending", "Crypto", ranking],
    staleTime: 10_000,
    enabled:
      view === "Trending" ||
      view === "All" ||
      view === "Top Gainers" ||
      view === "Top Losers" ||
      view === "Most Active",
    queryFn: ({ signal }) =>
      fetchJson<{ ok: boolean; data: TrendingInstrument[] }>(
        `/api/markets/trending?market=Crypto&ranking=${encodeURIComponent(ranking)}&limit=20`,
        signal,
      ),
  });
  const memes = useQuery({
    queryKey: ["trending", "Meme Coins", ranking],
    staleTime: 10_000,
    enabled: view === "Trending" || view === "All" || view === "Meme Coins",
    queryFn: ({ signal }) =>
      fetchJson<{ ok: boolean; data: TrendingInstrument[] }>(
        `/api/markets/trending?market=Meme%20Coins&ranking=Trending&limit=40&chain=${encodeURIComponent(memeChain)}&minLiquidity=${minimumLiquidity}`,
        signal,
      ),
  });
  const newMemes = useQuery({
    queryKey: ["new-memes", memeChain, minimumLiquidity, newAge],
    staleTime: 30_000,
    enabled: view === "Meme Coins" || view === "All",
    queryFn: ({ signal }) => fetchJson<{ ok: boolean; data: TrendingInstrument[] }>(
      `/api/markets/trending?market=Meme%20Coins&kind=new&ranking=Newest&limit=40&chain=${encodeURIComponent(memeChain)}&minLiquidity=${minimumLiquidity}&maxAgeMs=${newAge}`,
      signal,
    ),
  });
  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-[#090c11] p-4 pb-16 thin-scrollbar">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-center">
          <div>
            <h1 className="text-sm font-bold tracking-[.12em]">
              MARKET DISCOVERY
            </h1>
            <p className="mt-1 text-[9px] text-[#596170]">
              Provider catalogs load on demand and remain cached
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto grid size-8 place-items-center border border-[#252b35]"
          >
            <X size={14} />
          </button>
        </div>
        <MarketOpportunityScan
          result={marketScan.data?.data}
          loading={marketScan.isLoading || marketScan.isFetching}
          error={marketScan.isError ? (marketScan.error as Error).message : null}
          onRefresh={() => void marketScan.refetch()}
          onSelect={onSelect}
        />
        <div className="relative mt-4">
          <Search size={14} className="absolute left-3 top-3 text-[#596170]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search every cached provider instrument…"
            className="h-10 w-full border border-[#252b35] bg-[#0c1016] pl-9 text-[10px] outline-none focus:border-blue-500/60"
          />
          {deferredSearch.length >= 2 && (
            <SearchResults
              loading={searchQuery.isLoading}
              instruments={searchQuery.data?.instruments ?? []}
              favorites={favorites}
              onSelect={onSelect}
              onFavorite={onToggleFavorite}
            />
          )}
        </div>
        <div className="mt-4 flex overflow-x-auto border-b border-[#252b35]">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setView(tab);
                setSearch("");
              }}
              className={`shrink-0 border-b-2 px-3 py-2 text-[9px] ${view === tab ? "border-blue-500 text-blue-400" : "border-transparent text-[#687180]"}`}
            >
              {tab}
            </button>
          ))}
        </div>
        {(view === "Trending" || view === "All") && (
          <>
            <TrendingSection
              title="TRENDING NOW — CRYPTO"
              rows={crypto.data?.data ?? []}
              loading={crypto.isLoading}
              currentFacts={currentFacts}
              favorites={favorites}
              onSelect={onSelect}
              onFavorite={onToggleFavorite}
            />
            <TrendingSection
              title="TRENDING MEME COINS"
              rows={memes.data?.data ?? []}
              loading={memes.isLoading}
              currentFacts={currentFacts}
              favorites={favorites}
              onSelect={onSelect}
              onFavorite={onToggleFavorite}
              risky
            />
          </>
        )}
        {(view === "Top Gainers" ||
          view === "Top Losers" ||
          view === "Most Active") && (
          <TrendingSection
            title={view.toUpperCase()}
            rows={crypto.data?.data ?? []}
            loading={crypto.isLoading}
            currentFacts={currentFacts}
            favorites={favorites}
            onSelect={onSelect}
            onFavorite={onToggleFavorite}
          />
        )}{" "}
        {view === "Meme Coins" && (
          <>
            <MemeFilters chain={memeChain} onChain={setMemeChain} liquidity={minimumLiquidity} onLiquidity={setMinimumLiquidity} age={newAge} onAge={setNewAge} />
            <TrendingSection title="TRENDING MEME COINS" rows={memes.data?.data ?? []} loading={memes.isLoading} currentFacts={currentFacts} favorites={favorites} onSelect={onSelect} onFavorite={onToggleFavorite} risky />
            <TrendingSection title="NEW MEME COINS" rows={newMemes.data?.data ?? []} loading={newMemes.isLoading} currentFacts={currentFacts} favorites={favorites} onSelect={onSelect} onFavorite={onToggleFavorite} risky />
          </>
        )}
        {categoryViews.has(view as InstrumentCategory) && view !== "Meme Coins" && (
          <VirtualCatalog
            category={view as InstrumentCategory}
            favorites={favorites}
            onSelect={onSelect}
            onFavorite={onToggleFavorite}
          />
        )}{" "}
        {view === "All" && <ProviderSummary />}
      </div>
    </section>
  );
}

function MarketOpportunityScan({ result, loading, error, onRefresh, onSelect }: { result?: MarketScanResult; loading: boolean; error: string | null; onRefresh: () => void; onSelect: (asset: MarketAsset) => void }) {
  const preferred = result?.candidates.find((candidate) => candidate.symbol === result.preferredSymbol) ?? null;
  const qualified = result?.candidates.filter((candidate) => candidate.preference === "BUY") ?? [];
  return <section className="mt-4 border border-blue-500/30 bg-blue-500/[.05] p-4">
    <div className="flex items-center gap-2"><Sparkles size={15} className="text-blue-400"/><b className="text-[11px] tracking-widest text-white">AI ALL-MARKET INTRADAY SCAN</b><button onClick={onRefresh} disabled={loading} className="ml-auto grid size-8 place-items-center border border-[#303744] text-[#8993a1]"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/></button></div>
    {loading && !result ? <div className="mt-4 text-[10px] text-[#8993a1]">Scanning live 15M, 1H, and 4H data across every configured market…</div> : error && !result ? <div className="mt-4 text-[10px] text-amber-400">Scan unavailable: {error}</div> : preferred ? <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]"><div><div className="text-[9px] font-bold tracking-widest text-[#687180]">AI PREFERRED RIGHT NOW</div><button onClick={() => onSelect(findAsset(preferred.symbol))} className="mt-1 text-left"><span className="text-xl font-black text-[#16c784]">{preferred.setupScore >= 80 ? "STRONG BUY" : "BUY"} · {preferred.symbol}</span><span className="ml-2 text-[10px] text-[#8993a1]">{preferred.category}</span></button><p className="mt-2 max-w-3xl text-[10px] leading-5 text-[#bbc3cf]">{result?.rationale}</p></div><div className="border border-[#2b3542] bg-[#0b1017] px-4 py-3 text-[9px]"><div>Score <b className="text-white">{preferred.setupScore}/100</b></div><div className="mt-1">R:R <b className="text-white">1:{preferred.riskReward.ratio?.toFixed(2) ?? "—"}</b></div><div className="mt-1 text-[#687180]">{result?.source === "openai" ? `OpenAI preferred · ${result.model}` : "Rule-ranked fallback"}</div></div></div> : <div className="mt-4"><b className="text-base text-amber-400">WAIT — NO QUALIFIED BUY</b><p className="mt-2 text-[10px] text-[#8993a1]">{result?.rationale ?? "No completed scan yet."}</p></div>}
    {result && <div className="mt-3 border-t border-[#26303c] pt-3 text-[9px] text-[#687180]">Scanned {result.scanned} markets · {qualified.length} qualified BUY setup{qualified.length === 1 ? "" : "s"} · {result.unavailable} unavailable</div>}
  </section>;
}
function SearchResults({
  loading,
  instruments,
  favorites,
  onSelect,
  onFavorite,
}: {
  loading: boolean;
  instruments: Instrument[];
  favorites: MarketAsset[];
  onSelect: (asset: MarketAsset) => void;
  onFavorite: (asset: MarketAsset) => void;
}) {
  return (
    <div className="absolute inset-x-0 top-10 z-40 max-h-80 overflow-y-auto border border-[#303744] bg-[#10151c] shadow-2xl thin-scrollbar">
      {loading ? (
        <Status text="Searching cached provider catalogs…" />
      ) : instruments.length ? (
        instruments
          .slice(0, 50)
          .map((item) => (
            <InstrumentRow
              key={item.id}
              item={item}
              favorite={favorites.some((asset) => asset.symbol === item.symbol)}
              onSelect={onSelect}
              onFavorite={onFavorite}
            />
          ))
      ) : (
        <Status text="No provider instrument matched" />
      )}
    </div>
  );
}
function VirtualCatalog({
  category,
  favorites,
  onSelect,
  onFavorite,
}: {
  category: InstrumentCategory;
  favorites: MarketAsset[];
  onSelect: (asset: MarketAsset) => void;
  onFavorite: (asset: MarketAsset) => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const query = useInfiniteQuery({
    queryKey: ["catalog", category],
    initialPageParam: 1,
    staleTime: 30 * 60_000,
    queryFn: ({ pageParam, signal }) =>
      fetchJson<{
        ok: boolean;
        instruments: Instrument[];
        total: number;
        hasMore: boolean;
        page: number;
        source: string;
        provider: string;
        stale: boolean;
        message?: string;
      }>(
        `/api/markets/catalog?category=${encodeURIComponent(category)}&page=${pageParam}&pageSize=200`,
        signal,
      ),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
  const instruments =
    query.data?.pages.flatMap((page) => page.instruments) ?? [];
  const virtualizer = useVirtualizer({
    count: instruments.length,
    getScrollElement: () => parent.current,
    estimateSize: () => (category === "Futures" ? 48 : 39),
    overscan: 8,
  });
  useEffect(() => {
    const last = virtualizer.getVirtualItems().at(-1);
    if (
      last &&
      last.index >= instruments.length - 15 &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    )
      void query.fetchNextPage();
  }, [instruments.length, query, virtualizer]);
  if (query.isLoading) return <Status text={`Loading ${category} catalog…`} />;
  if (query.isError)
    return (
      <Status text={`Catalog unavailable: ${(query.error as Error).message}`} />
    );
  if (!instruments.length)
    return <Status text={query.data?.pages[0].message ?? `No ${category} instruments discovered from configured providers.`} />;
  return (
    <section className="mt-5 border border-[#20242d]">
      <div className="flex h-9 items-center border-b border-[#20242d] px-3 text-[8px]">
        <b>
          {category.toUpperCase()} —{" "}
          {query.data?.pages[0].total.toLocaleString()} INSTRUMENTS
        </b>
        <span className="ml-auto text-[#687180]">
          {query.data?.pages[0].provider}
          {query.data?.pages[0].stale ? " • STALE" : ""}
        </span>
      </div>
      <div ref={parent} className="h-[480px] overflow-auto thin-scrollbar">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const item = instruments[row.index];
            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${row.start}px)`,
                }}
              >
                <InstrumentRow
                  item={item}
                  favorite={favorites.some(
                    (asset) => asset.symbol === item.symbol,
                  )}
                  onSelect={onSelect}
                  onFavorite={onFavorite}
                />
              </div>
            );
          })}
        </div>
        {query.isFetchingNextPage && (
          <Status text="Loading more instruments…" />
        )}
      </div>
    </section>
  );
}
function InstrumentRow({
  item,
  favorite,
  onSelect,
  onFavorite,
}: {
  item: Instrument;
  favorite: boolean;
  onSelect: (asset: MarketAsset) => void;
  onFavorite: (asset: MarketAsset) => void;
}) {
  if (item.marketCategory === "Futures")
    return <FuturesInstrumentRow item={item} favorite={favorite} onSelect={onSelect} onFavorite={onFavorite} />;
  const asset = toAsset(item);
  const chartable = asset.dataStatus !== "UNAVAILABLE";
  return (
    <div className="grid h-[39px] grid-cols-[28px_1fr_1.6fr_.8fr_.8fr_.8fr] items-center border-b border-[#181d24] px-2 text-[8px] hover:bg-[#121821]">
      <button
        onClick={() => onFavorite(asset)}
        className={favorite ? "text-amber-400" : "text-[#46505d]"}
      >
        <Star size={11} fill={favorite ? "currentColor" : "none"} />
      </button>
      <button
        disabled={!chartable}
        onClick={() => onSelect(asset)}
        className="text-left font-semibold text-white disabled:text-[#687180]"
      >
        {item.symbol}
      </button>
      <span className="truncate text-[#8993a1]">{item.displayName}</span>
      <span>{item.marketCategory}</span>
      <span>{item.exchange}</span>
      <span
        className={item.source === "LIVE" ? "text-[#16c784]" : "text-amber-400"}
      >
        {item.source === "LIVE" ? `LIVE • ${item.provider}` : "UNAVAILABLE"}
      </span>
    </div>
  );
}
function FuturesInstrumentRow({ item, favorite, onSelect, onFavorite }: { item: Instrument; favorite: boolean; onSelect: (asset: MarketAsset) => void; onFavorite: (asset: MarketAsset) => void }) {
  const asset = toAsset(item);
  const quote = useQuery({
    queryKey: ["futures-row-quote", item.symbol], staleTime: 30_000,
    queryFn: ({ signal }) => fetchJson<{ ok: boolean; data: { price: number; changePercent: number } }>(`/api/market/quote?symbol=${encodeURIComponent(item.symbol)}&category=Futures`, signal),
  });
  return <div className="grid h-12 grid-cols-[28px_1.4fr_.65fr_.7fr_.75fr_.7fr_.65fr_.7fr] items-center border-b border-[#181d24] px-2 text-[8px] hover:bg-[#121821]">
    <button onClick={() => onFavorite(asset)} className={favorite ? "text-amber-400" : "text-[#46505d]"}><Star size={11} fill={favorite ? "currentColor" : "none"} /></button>
    <button onClick={() => onSelect(asset)} className="min-w-0 text-left"><b className="block truncate text-white">{item.displayName}</b><span className="text-[#687180]">{item.symbol} • {item.futuresCategory}</span></button>
    <span>{item.exchange}</span><span>{item.contractMonth ?? item.expiry ?? "—"}</span>
    <span className="font-mono">{quote.data ? quote.data.data.price.toLocaleString() : quote.isLoading ? "Loading…" : "Unavailable"}</span>
    <span className={(quote.data?.data.changePercent ?? 0) >= 0 ? "text-[#16c784]" : "text-[#ea3943]"}>{quote.data ? `${quote.data.data.changePercent >= 0 ? "+" : ""}${quote.data.data.changePercent.toFixed(2)}%` : "—"}</span>
    <span>{item.volume24h ? compact(item.volume24h) : "—"}</span><span className="text-[#16c784]">{item.provider}</span>
  </div>;
}
function TrendingSection({
  title,
  rows,
  loading,
  currentFacts,
  favorites,
  onSelect,
  onFavorite,
  risky = false,
}: {
  title: string;
  rows: TrendingInstrument[];
  loading: boolean;
  currentFacts: RuleBasedSetup | null;
  favorites: MarketAsset[];
  onSelect: (asset: MarketAsset) => void;
  onFavorite: (asset: MarketAsset) => void;
  risky?: boolean;
}) {
  return (
    <section className="mt-5 border border-[#20242d]">
      <div className="flex h-9 items-center border-b border-[#20242d] px-3">
        <b className="text-[9px] tracking-widest">{title}</b>
        {risky && (
          <span className="ml-3 flex gap-1 text-[7px] text-red-400">
            <ShieldAlert size={9} />
            HIGH RISK
          </span>
        )}
        <span className="ml-auto text-[8px] text-[#16c784]">
          LIVE • {rows[0]?.provider ?? "Market providers"}
        </span>
      </div>
      {risky && !loading && rows.length > 0 && (
        <div className="grid grid-cols-[24px_24px_1.3fr_repeat(6,.55fr)_.7fr_.7fr_.7fr_.65fr_.7fr_.7fr_.8fr] gap-1 border-b border-[#252b35] px-2 py-1 text-[7px] text-[#596170]">
          <span /><span>#</span><span>TOKEN / CHAIN</span><span>PRICE</span><span>5M</span><span>1H</span><span>6H</span><span>24H</span><span>VOLUME</span><span>LIQUIDITY</span><span>FDV/MC</span><span>AGE</span><span>BUYS/SELLS</span><span>TREND</span><span>AI</span><span>SOURCE</span>
        </div>
      )}
      {loading ? (
        <Status text="Loading cached activity…" />
      ) : rows.length ? (
        rows.map((row, index) => {
          const known = findAsset(row.symbol);
          const asset =
            known.symbol === row.symbol
              ? known
              : ({
                  symbol: row.symbol,
                  name: row.name,
                  exchange: "BINANCE",
                  category: row.market,
                  price: row.price,
                  change: row.changePercent,
                  decimals: 8,
                  volatility: row.volatility / 100,
                  dataStatus: "LIVE",
                  chain: row.chain,
                  chainId: row.chainId,
                  contractAddress: row.contractAddress,
                  pairAddress: row.pairAddress,
                  provider: row.provider,
                  dex: row.dex,
                  liquidity: row.liquidity,
                  pairCreatedAt: row.pairCreatedAt,
                  insufficientHistory: row.riskFlags?.includes("INSUFFICIENT HISTORY"),
                } as MarketAsset);
          const analyzed =
            currentFacts?.symbol === row.symbol ? currentFacts : null;
          return (
            <div
              key={row.id ?? `${row.provider}:${row.symbol}`}
              className={`grid items-center gap-1 border-b border-[#181d24] px-2 py-2 font-mono text-[8px] ${risky ? "grid-cols-[24px_24px_1.3fr_repeat(6,.55fr)_.7fr_.7fr_.7fr_.65fr_.7fr_.7fr_.8fr]" : "grid-cols-[28px_28px_1fr_.8fr_.8fr_.8fr_.8fr_.7fr_.7fr_.7fr]"}`}
            >
              <button
                onClick={() => onFavorite(asset)}
                className={
                  favorites.some((item) => item.symbol === asset.symbol)
                    ? "text-amber-400"
                    : "text-[#46505d]"
                }
              >
                <Star size={10} />
              </button>
              <span>{index + 1}</span>
              <button
                onClick={() => onSelect(asset)}
                className="text-left font-sans font-semibold text-white"
              >
                <span className="block">{row.name}</span>
                <span className="block text-[7px] font-normal text-[#687180]">{row.symbol}{row.chain ? ` • ${row.chain}` : ""}</span>
              </button>
              <span>{row.price.toLocaleString()}</span>
              {risky && <><Change value={row.change5m} /><Change value={row.change1h} /><Change value={row.change6h} /></>}
              <span
                className={
                  row.changePercent >= 0 ? "text-[#16c784]" : "text-[#ea3943]"
                }
              >
                {row.changePercent.toFixed(2)}%
              </span>
              <span>{compact(row.volume)}</span>
              <span>{risky ? compact(row.liquidity ?? 0) : `${row.volatility.toFixed(2)}%`}</span>
              {risky && <><span>{compact(row.marketCap || row.fdv || 0)}</span><span>{ageLabel(row.pairAgeMs)}</span><span>{row.buys24h ?? 0}/{row.sells24h ?? 0}</span></>}
              <span className="text-blue-400">{row.trendingScore}</span>
              <span>{analyzed?.preference ?? "—"}</span>
              {!risky && <span>
                {analyzed
                  ? `${analyzed.buyScore.total}/${analyzed.sellScore.total}`
                  : "—"}
              </span>}
              {risky && <span title={row.riskFlags?.join(" • ")} className={row.riskFlags?.length ? "truncate text-amber-400" : "truncate text-[#687180]"}>{row.riskFlags?.[0] ?? row.provider}</span>}
            </div>
          );
        })
      ) : (
        <Status text="Trending data unavailable for this market" />
      )}
    </section>
  );
}
function Change({ value }: { value?: number }) { return <span className={(value ?? 0) >= 0 ? "text-[#16c784]" : "text-[#ea3943]"}>{value == null ? "—" : `${value.toFixed(1)}%`}</span>; }
function ageLabel(ageMs?: number) { if (ageMs == null) return "—"; const minutes = Math.floor(ageMs / 60_000); return minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`; }
function MemeFilters({ chain, onChain, liquidity, onLiquidity, age, onAge }: { chain: string; onChain: (value: string) => void; liquidity: number; onLiquidity: (value: number) => void; age: number; onAge: (value: number) => void }) {
  return <div className="mt-5 grid gap-2 border border-[#252b35] bg-[#0c1016] p-3 sm:grid-cols-3">
    <SelectFilter label="CHAIN" value={chain} onChange={onChain} options={["All", "Solana", "Ethereum", "Base", "BNB Chain", "Arbitrum", "Polygon"]} />
    <SelectFilter label="MINIMUM LIQUIDITY" value={String(liquidity)} onChange={(value) => onLiquidity(Number(value))} options={["0", "1000", "10000", "50000", "100000"]} labels={["Any", "$1k", "$10k", "$50k", "$100k+"]} />
    <SelectFilter label="CREATED" value={String(age)} onChange={(value) => onAge(Number(value))} options={["900000", "3600000", "21600000", "86400000", "604800000"]} labels={["Last 15 minutes", "Last hour", "Last 6 hours", "Last 24 hours", "Last 7 days"]} />
  </div>;
}
function SelectFilter({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: string[] }) {
  return <label className="text-[8px] text-[#687180]">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-8 w-full border border-[#252b35] bg-[#090c11] px-2 text-[9px] text-[#b7bec9] outline-none">{options.map((option, index) => <option key={option} value={option}>{labels?.[index] ?? option}</option>)}</select></label>;
}
function ProviderSummary() {
  const query = useQuery({ queryKey: ["provider-status"], staleTime: 60_000, queryFn: ({ signal }) => fetchJson<{ ok: boolean; data: (ProviderCapability & { connected: boolean; configuration?: string })[] }>("/api/markets/capabilities", signal) });
  return <section className="mt-5"><h2 className="text-[9px] font-bold tracking-widest">DATA PROVIDERS</h2><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{query.data?.data.map((provider) => <div key={provider.provider} className="border border-[#252b35] bg-[#0c1016] p-3 text-[8px]"><b className="text-[#c8d0dc]">{provider.provider}</b><div className="mt-1 text-[#687180]">{provider.markets.join(" • ")}</div><div className={`mt-2 font-bold ${provider.connected ? "text-[#16c784]" : "text-amber-400"}`}>{provider.connected ? "CONNECTED" : "NOT CONFIGURED"}</div>{provider.configuration && <div className="mt-1 text-[#687180]">{provider.configuration}</div>}</div>)}</div></section>;
}
function Status({ text }: { text: string }) {
  return (
    <div className="p-6 text-center text-[9px] text-[#687180]">{text}</div>
  );
}
const compact = (value: number) =>
  Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
