"use client";
import { useEffect, useState } from "react";
import type {
  Candle,
  DataSourceKind,
  MarketApiResponse,
  MarketSymbol,
  Quote,
  SymbolSearchResult,
  Timeframe,
} from "@/lib/market-data/types";
import { marketCatalog, normalizeMarketAsset } from "@/lib/market-data";
import {
  analyzeMultipleTimeframes,
  analyzeMultiTimeframePatterns,
  type MultiTimeframePatternAnalysis,
  type MultiTimeframeStructureAnalysis,
  type PatternSensitivity,
} from "@/lib/analysis";
import { useQuery } from "@tanstack/react-query";
import { reportPerformanceMetric } from "@/lib/performance";

type RemoteState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  source: DataSourceKind;
  provider: string;
};
const initial = <T>(): RemoteState<T> => ({
  data: null,
  loading: true,
  error: null,
  source: "UNAVAILABLE",
  provider: "Unavailable",
});
const paramsFor = (asset: MarketSymbol) => {
  const params = new URLSearchParams({ symbol: asset.symbol, category: asset.category });
  if (asset.chainId) params.set("chainId", asset.chainId);
  if (asset.pairAddress) params.set("pairAddress", asset.pairAddress);
  return params.toString();
};

export function useMarketCandles(asset: MarketSymbol, timeframe: Timeframe) {
  const [state, setState] = useState<RemoteState<Candle[]>>(initial);
  useEffect(() => {
    let controller: AbortController | null = null;
    let active = true;
    const load = async (showLoading: boolean) => {
      const started = performance.now();
      controller?.abort();
      controller = new AbortController();
      if (showLoading)
        setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const response = await fetch(
          `/api/market/candles?${paramsFor(asset)}&timeframe=${timeframe}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as MarketApiResponse<Candle[]>;
        if (!active) return;
        if (!response.ok || !body.ok || !body.data)
          setState({
            data: null,
            loading: false,
            error: body.message ?? "Data unavailable",
            source: "UNAVAILABLE",
            provider: body.provider,
          });
        else {
          setState({
            data: body.data,
            loading: false,
            error: null,
            source: body.source,
            provider: body.provider,
          });
          reportPerformanceMetric("Candle fetch", performance.now() - started);
        }
      } catch (error) {
        if (active && (error as Error).name !== "AbortError")
          setState({
            data: null,
            loading: false,
            error: "Unable to load market history",
            source: "UNAVAILABLE",
            provider: "Unavailable",
          });
      }
    };
    void load(true);
    const refreshMs =
      timeframe === "15m" ? 30_000 : timeframe === "1H" ? 60_000 : 180_000;
    const timer = window.setInterval(() => void load(false), refreshMs);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [asset, timeframe]);
  return state;
}

export function useMarketQuote(asset: MarketSymbol) {
  const [state, setState] = useState<RemoteState<Quote>>(initial);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let attempts = 0;
    const loadQuote = async () => {
      const started = performance.now();
      try {
        const response = await fetch(`/api/market/quote?${paramsFor(asset)}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as MarketApiResponse<Quote>;
        if (!active) return;
        if (!response.ok || !body.ok || !body.data)
          setState({
            data: null,
            loading: false,
            error: body.message ?? "Data unavailable",
            source: "UNAVAILABLE",
            provider: body.provider,
          });
        else {
          setState({
            data: body.data,
            loading: false,
            error: null,
            source: body.source,
            provider: body.provider,
          });
          reportPerformanceMetric("Quote fetch", performance.now() - started);
        }
      } catch (error) {
        if (active && (error as Error).name !== "AbortError")
          setState((current) => ({
            ...current,
            loading: false,
            error: "Quote update unavailable",
          }));
      }
    };
    const connect = () => {
      if (
        !active ||
        !(asset.category === "Crypto" || asset.category === "Meme Coins") ||
        attempts >= 3
      )
        return;
      attempts += 1;
      const stream = asset.symbol.replace("/", "").toLowerCase();
      socket = new WebSocket(
        `${process.env.NEXT_PUBLIC_BINANCE_WS_URL ?? "wss://stream.binance.com:9443"}/ws/${stream}@ticker`,
      );
      socket.onopen = () => {
        /* Connection established; retain the total retry budget. */
      };
      socket.onmessage = (event) => {
        try {
          const tick = JSON.parse(event.data) as {
            c: string;
            p: string;
            P: string;
            E: number;
          };
          if (!active) return;
          setState({
            data: {
              symbol: asset.symbol,
              price: Number(tick.c),
              change: Number(tick.p),
              changePercent: Number(tick.P),
              timestamp: tick.E,
            },
            loading: false,
            error: null,
            source: "LIVE",
            provider: "Binance",
          });
        } catch {
          /* Ignore malformed provider frames. */
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (active && attempts < 3)
          retryTimer = window.setTimeout(connect, 1000 * 2 ** attempts);
      };
    };
    void loadQuote();
    connect();
    const poll = window.setInterval(loadQuote, 30_000);
    return () => {
      active = false;
      controller.abort();
      socket?.close();
      if (retryTimer) window.clearTimeout(retryTimer);
      window.clearInterval(poll);
    };
  }, [asset]);
  return state;
}

export function useSymbolSearch(
  category: MarketSymbol["category"],
  query: string,
) {
  const [results, setResults] = useState<SymbolSearchResult[] | null>(null);
  useEffect(() => {
    if (!query.trim()) {
      const frame = window.requestAnimationFrame(() => setResults(null));
      return () => window.cancelAnimationFrame(frame);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/market/search?category=${encodeURIComponent(category)}&q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as MarketApiResponse<
          SymbolSearchResult[]
        >;
        if (response.ok && body.ok) setResults(body.data);
      } catch {
        /* Keep the previous safe result on search failure. */
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, query]);
  return results;
}

export function useWatchlistQuotes(category: MarketSymbol["category"]) {
  const [quotes, setQuotes] = useState<
    Record<string, Quote & { source: DataSourceKind; provider: string }>
  >({});
  useEffect(() => {
    let active = true;
    let controllers: AbortController[] = [];
    const load = async () => {
      controllers.forEach((controller) => controller.abort());
      controllers = [];
      const entries = await Promise.all(
        marketCatalog[category].map(async (asset) => {
          const controller = new AbortController();
          controllers.push(controller);
          try {
            const response = await fetch(
              `/api/market/quote?${paramsFor(asset)}`,
              { signal: controller.signal },
            );
            const body = (await response.json()) as MarketApiResponse<Quote>;
            return response.ok && body.ok && body.data
              ? ([
                  asset.symbol,
                  {
                    ...body.data,
                    source: body.source,
                    provider: body.provider,
                  },
                ] as const)
              : null;
          } catch {
            return null;
          }
        }),
      );
      if (active)
        setQuotes(
          Object.fromEntries(
            entries.filter(
              (
                entry,
              ): entry is readonly [
                string,
                Quote & { source: DataSourceKind; provider: string },
              ] => entry !== null,
            ),
          ),
        );
    };
    void load();
    const timer = window.setInterval(
      load,
      category === "Crypto" || category === "Meme Coins" ? 30_000 : 60_000,
    );
    return () => {
      active = false;
      controllers.forEach((controller) => controller.abort());
      window.clearInterval(timer);
    };
  }, [category]);
  return quotes;
}

export function useBatchQuotes(assets: MarketSymbol[]) {
  const normalizedAssets = assets.map(normalizeMarketAsset);
  const key = normalizedAssets.map((asset) => `${asset.category}:${asset.symbol}`).sort();
  return useQuery({
    queryKey: ["watchlist-quotes", key],
    enabled: assets.length > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/market/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruments: normalizedAssets.map(({ symbol, category, chainId, pairAddress }) => ({
            symbol,
            category,
            chainId,
            pairAddress,
          })),
        }),
        signal,
      });
      const body = (await response.json()) as {
        ok: boolean;
        data: { quote: Quote; source: DataSourceKind; provider: string }[];
        message?: string;
      };
      if (!response.ok || !body.ok)
        throw new Error(body.message ?? "Watchlist quotes unavailable");
      return Object.fromEntries(
        body.data.map((item) => [
          item.quote.symbol,
          { ...item.quote, source: item.source, provider: item.provider },
        ]),
      ) as Record<string, Quote & { source: DataSourceKind; provider: string }>;
    },
  });
}

export function useMultiTimeframeStructure(
  asset: MarketSymbol,
  patternSensitivity: PatternSensitivity = "medium",
  enabled = true,
) {
  const [state, setState] = useState<{
    analysis: MultiTimeframeStructureAnalysis | null;
    patterns: MultiTimeframePatternAnalysis | null;
    recentCandles: Candle[];
    loading: boolean;
    error: string | null;
    source: DataSourceKind;
    provider: string;
  }>({
    analysis: null,
    patterns: null,
    recentCandles: [],
    loading: true,
    error: null,
    source: "UNAVAILABLE",
    provider: "Unavailable",
  });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let controllers: AbortController[] = [];
    let confirmedSignature = "";
    let patternSignature = "";
    let cachedAnalysis: MultiTimeframeStructureAnalysis | null = null;
    const timeframes: Timeframe[] = ["4H", "1H", "15m"];
    const load = async () => {
      controllers.forEach((controller) => controller.abort());
      controllers = [];
      try {
        const responses = await Promise.all(
          timeframes.map(async (timeframe) => {
            const controller = new AbortController();
            controllers.push(controller);
            const response = await fetch(
              `/api/market/candles?${paramsFor(asset)}&timeframe=${timeframe}`,
              { signal: controller.signal },
            );
            const body = (await response.json()) as MarketApiResponse<Candle[]>;
            if (!response.ok || !body.ok || !body.data)
              throw new Error(body.message ?? "Structure data unavailable");
            return { timeframe, ...body, data: body.data };
          }),
        );
        if (!active) return;
        if (new Set(responses.map((item) => item.source)).size !== 1)
          throw new Error("Live and mock timeframe data cannot be combined");
        const signature = responses
          .map((item) => `${item.timeframe}:${item.data.at(-2)?.time ?? 0}`)
          .join("|");
        const datasets = Object.fromEntries(
          responses.map((item) => [item.timeframe, item.data]),
        ) as Partial<Record<Timeframe, Candle[]>>;
        const structureStarted = performance.now();
        if (signature !== confirmedSignature || !cachedAnalysis) {
          confirmedSignature = signature;
          cachedAnalysis = analyzeMultipleTimeframes(asset.symbol, datasets);
          reportPerformanceMetric(
            "Structure analysis",
            performance.now() - structureStarted,
          );
        }
        const nextPatternSignature = responses
          .map((item) => {
            const last = item.data.at(-1);
            return `${item.timeframe}:${last?.time}:${last?.open}:${last?.high}:${last?.low}:${last?.close}`;
          })
          .join("|");
        if (nextPatternSignature === patternSignature) return;
        patternSignature = nextPatternSignature;
        const patternStarted = performance.now();
        const patternAnalysis = analyzeMultiTimeframePatterns(
          asset.symbol,
          datasets,
          cachedAnalysis,
          { sensitivity: patternSensitivity },
        );
        reportPerformanceMetric(
          "Pattern analysis",
          performance.now() - patternStarted,
        );
        setState({
          analysis: cachedAnalysis,
          patterns: patternAnalysis,
          recentCandles: (datasets["15m"] ?? []).slice(-5),
          loading: false,
          error: null,
          source: responses.every((item) => item.source === "LIVE")
            ? "LIVE"
            : "MOCK",
          provider: responses[0].provider,
        });
      } catch (error) {
        if (active && (error as Error).name !== "AbortError")
          setState((current) => ({
            ...current,
            loading: false,
            error: (error as Error).message,
          }));
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      active = false;
      controllers.forEach((controller) => controller.abort());
      window.clearInterval(timer);
    };
  }, [asset, enabled, patternSensitivity]);
  return state;
}
