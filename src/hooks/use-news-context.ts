"use client";
import { useEffect, useState } from "react";
import type { MarketSymbol } from "@/lib/market-data/types";
import type { SymbolNewsContext } from "@/lib/news";
import { reportPerformanceMetric } from "@/lib/performance";
export function useNewsContext(asset: MarketSymbol, enabled = true) {
  const [data, setData] = useState<SymbolNewsContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      const started = performance.now();
      setLoading(true);
      setData(null);
      try {
        const response = await fetch(
          `/api/news-risk?symbol=${encodeURIComponent(asset.symbol)}&category=${encodeURIComponent(asset.category)}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as {
          data: SymbolNewsContext | null;
          message?: string;
        };
        if (!active) return;
        if (!body.data)
          throw new Error(body.message ?? "News temporarily unavailable");
        setData(body.data);
        reportPerformanceMetric("News fetch", performance.now() - started);
        setError(
          body.data.source === "UNAVAILABLE"
            ? "News temporarily unavailable"
            : null,
        );
      } catch (requestError) {
        if (active && (requestError as Error).name !== "AbortError") {
          setData(null);
          setError("News temporarily unavailable");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void Promise.resolve().then(load);
    const timer = setInterval(() => void load(), 5 * 60_000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [asset.category, asset.symbol, enabled]);
  return { data, loading, error };
}
