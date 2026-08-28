"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import {
  findAsset,
  formatPrice,
  type IndicatorKey,
  type MarketAsset,
  type MarketCategory,
  type Timeframe,
} from "@/lib/market-data";
import type { Quote } from "@/lib/market-data/types";
import type { Instrument } from "@/lib/instruments/types";

const frames: Timeframe[] = ["15m", "1H", "4H", "1D"];
const indicatorOptions: { key: IndicatorKey; label: string; color: string }[] =
  [
    { key: "ema20", label: "EMA 20", color: "#3b82f6" },
    { key: "ema50", label: "EMA 50", color: "#f59e0b" },
    { key: "volume", label: "Volume", color: "#64748b" },
    { key: "levels", label: "Support / Resistance", color: "#a78bfa" },
    { key: "structure", label: "HH / HL / LH / LL", color: "#60a5fa" },
    { key: "swings", label: "Raw Swing Points", color: "#94a3b8" },
    { key: "trend", label: "Trend Badge", color: "#22d3ee" },
    { key: "patterns", label: "Candlestick Patterns", color: "#e879f9" },
  ];

export function Header({
  asset,
  quote,
  timeframe,
  indicators,
  onTimeframeChange,
  onToggleIndicator,
  favorites,
  onSelectAsset,
  onOpenBuyAlerts,
}: {
  asset: MarketAsset;
  quote: Quote | null;
  timeframe: Timeframe;
  indicators: Set<IndicatorKey>;
  onTimeframeChange: (value: Timeframe) => void;
  onToggleIndicator: (key: IndicatorKey) => void;
  favorites: MarketAsset[];
  onSelectAsset: (asset: MarketAsset) => void;
  onOpenBuyAlerts: () => void;
}) {
  const [indicatorMenu, setIndicatorMenu] = useState(false);
  const [symbolMenu, setSymbolMenu] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [results, setResults] = useState<Instrument[]>([]);
  const [searching, setSearching] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!symbolMenu || symbolQuery.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/markets/catalog?q=${encodeURIComponent(symbolQuery.trim())}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as {
          ok: boolean;
          instruments?: Instrument[];
        };
        setResults(
          response.ok && body.ok ? (body.instruments ?? []).slice(0, 30) : [],
        );
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [symbolMenu, symbolQuery]);
  useEffect(() => {
    if (!symbolMenu) return;
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node))
        setSymbolMenu(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [symbolMenu]);
  const choose = (next: MarketAsset) => {
    onSelectAsset(next);
    setSymbolMenu(false);
    setSymbolQuery("");
    setResults([]);
  };
  const changePercent = quote?.changePercent ?? asset.change;
  const positive = changePercent >= 0;
  return (
    <header className="relative flex h-14 shrink-0 items-center border-b border-[#20242d] bg-[#0c0f14] px-3">
      <div className="flex w-[262px] shrink-0 items-center gap-2.5">
        <span className="grid size-7 place-items-center bg-blue-600 text-[11px] font-black text-white">
          AI
        </span>
        <span className="text-sm font-semibold tracking-wide text-white">
          AI Trading
        </span>
      </div>
      <div ref={pickerRef} className="relative">
        <button
          aria-haspopup="dialog"
          aria-expanded={symbolMenu}
          onClick={() => {
            setSymbolMenu((value) => !value);
            setIndicatorMenu(false);
          }}
          className={`flex h-8 items-center gap-2 border bg-[#12161d] px-3 text-xs font-semibold text-white hover:bg-[#171c24] ${symbolMenu ? "border-blue-500" : "border-[#2a303b]"}`}
        >
          <span className="grid size-4 place-items-center rounded-full bg-blue-600 text-[8px]">
            {asset.symbol.slice(0, 1)}
          </span>
          {asset.symbol}
          <ChevronDown
            size={13}
            className={`text-[#717989] transition-transform ${symbolMenu ? "rotate-180" : ""}`}
          />
        </button>
        {symbolMenu && (
          <div className="absolute left-0 top-10 z-[70] w-80 border border-[#303744] bg-[#10151c] shadow-2xl">
            <div className="relative border-b border-[#252b35] p-2">
              <Search
                size={13}
                className="absolute left-4 top-4 text-[#596170]"
              />
              <input
                autoFocus
                value={symbolQuery}
                onChange={(event) => setSymbolQuery(event.target.value)}
                placeholder="Search BTC, EURUSD, Gold, AAPL…"
                className="h-8 w-full border border-[#252b35] bg-[#090c11] pl-8 pr-8 text-[10px] outline-none focus:border-blue-500"
              />
              {symbolQuery && (
                <button
                  onClick={() => {
                    setSymbolQuery("");
                    setResults([]);
                  }}
                  className="absolute right-3 top-3 grid size-6 place-items-center text-[#687180]"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto thin-scrollbar">
              <div className="px-3 py-2 text-[8px] font-bold tracking-widest text-[#596170]">
                {symbolQuery.trim().length >= 2
                  ? "SEARCH RESULTS"
                  : "WATCHLIST"}
              </div>
              {symbolQuery.trim().length >= 2 ? (
                searching ? (
                  <PickerStatus text="Searching instruments…" />
                ) : results.length ? (
                  results.map((item) => (
                    <PickerRow
                      key={item.id}
                      asset={instrumentToAsset(item)}
                      label={item.displayName}
                      source={`${item.source} • ${item.provider}`}
                      onChoose={choose}
                    />
                  ))
                ) : (
                  <PickerStatus text="No matching instrument" />
                )
              ) : (
                favorites.map((item) => (
                  <PickerRow
                    key={`${item.category}:${item.symbol}`}
                    asset={item}
                    label={item.name}
                    source={
                      item.dataStatus === "UNAVAILABLE"
                        ? "UNAVAILABLE"
                        : item.exchange
                    }
                    onChoose={choose}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <div className="ml-3 hidden border-l border-[#262b35] pl-3 font-mono sm:block">
        <div
          className={`text-[15px] font-semibold ${positive ? "text-[#16c784]" : "text-[#ea3943]"}`}
        >
          {quote ? formatPrice(asset, quote.price) : "—"}
        </div>
        <div
          className={`text-[9px] ${positive ? "text-[#16c784]" : "text-[#ea3943]"}`}
        >
          {quote
            ? `${positive ? "+" : ""}${changePercent.toFixed(2)}%`
            : "Loading quote"}
        </div>
      </div>
      <div className="mx-auto flex items-center gap-0.5 bg-[#0a0d12] p-0.5">
        {frames.map((frame) => (
          <button
            key={frame}
            onClick={() => onTimeframeChange(frame)}
            className={`h-7 min-w-10 px-2 text-[11px] font-semibold ${timeframe === frame ? "bg-[#232a35] text-white" : "text-[#7f8796] hover:text-white"}`}
          >
            {frame}
          </button>
        ))}
      </div>
      <div className="hidden items-center gap-1.5 xl:flex">
        <Link href="/recommendations" className="flex h-8 items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/15">
          <Sparkles size={14} /> Recommended Buys
        </Link>
        <button
          onClick={() => setIndicatorMenu((value) => !value)}
          className={`flex h-8 items-center gap-2 border px-3 text-[11px] ${indicatorMenu ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-[#252a34] text-[#aeb5c1] hover:bg-[#171b22]"}`}
        >
          <SlidersHorizontal size={14} />
          Indicators{" "}
          <span className="text-[9px] text-[#596170]">{indicators.size}</span>
        </button>
        <button onClick={onOpenBuyAlerts} className="flex h-8 items-center gap-2 border border-[#252a34] px-3 text-[11px] text-[#aeb5c1] hover:bg-[#171b22]">
          <Bell size={14} />
          Alerts
        </button>
        <button
          aria-label="Settings"
          className="grid size-8 place-items-center text-[#89919f] hover:bg-[#171b22]"
        >
          <Settings size={16} />
        </button>
      </div>
      {indicatorMenu && (
        <div className="absolute right-20 top-12 z-50 w-56 border border-[#2a303b] bg-[#11151c] p-1 shadow-2xl">
          <div className="px-2 py-2 text-[9px] font-bold tracking-[.15em] text-[#5d6675]">
            CHART INDICATORS
          </div>
          {indicatorOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => onToggleIndicator(option.key)}
              className="flex w-full items-center gap-2 px-2 py-2 text-left text-[11px] text-[#b7bec9] hover:bg-[#1a2029]"
            >
              <span className="size-2" style={{ background: option.color }} />
              {option.label}
              {indicators.has(option.key) && (
                <Check size={13} className="ml-auto text-blue-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function instrumentToAsset(item: Instrument): MarketAsset {
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
    productCode: item.productCode,
    expiry: item.expiry,
    contractMonth: item.contractMonth,
    futuresCategory: item.futuresCategory,
    continuous: item.continuous,
    chain: item.chain,
    chainId: item.chainId,
    contractAddress: item.contractAddress,
    pairAddress: item.pairAddress,
    provider: item.provider,
    dex: item.dex,
    liquidity: item.liquidity,
    pairCreatedAt: item.pairCreatedAt,
    insufficientHistory: item.riskFlags?.includes("INSUFFICIENT HISTORY"),
  };
}
function PickerRow({
  asset,
  label,
  source,
  onChoose,
}: {
  asset: MarketAsset;
  label: string;
  source: string;
  onChoose: (asset: MarketAsset) => void;
}) {
  const unavailable = asset.dataStatus === "UNAVAILABLE";
  return (
    <button
      disabled={unavailable}
      onClick={() => onChoose(asset)}
      className="grid w-full grid-cols-[1fr_auto] items-center border-t border-[#1d222b] px-3 py-2.5 text-left hover:bg-[#171d26] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="min-w-0">
        <b className="block text-[10px] text-white">{asset.symbol}</b>
        <span className="block truncate text-[8px] text-[#687180]">
          {label}
        </span>
      </span>
      <span
        className={`text-[7px] ${unavailable ? "text-amber-400" : "text-emerald-400"}`}
      >
        {unavailable ? "DATA UNAVAILABLE" : source}
      </span>
    </button>
  );
}
function PickerStatus({ text }: { text: string }) {
  return (
    <div className="px-3 py-8 text-center text-[9px] text-[#687180]">
      {text}
    </div>
  );
}
