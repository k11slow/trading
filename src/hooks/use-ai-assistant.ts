"use client";
import { useCallback, useEffect, useState } from "react";
import type {
  AIHistoryEntry,
  ExplanationMode,
  RuleBasedSetup,
  TradingAssistantResult,
} from "@/lib/ai";
import { reportPerformanceMetric } from "@/lib/performance";
type AssistantState = {
  result: TradingAssistantResult | null;
  loading: boolean;
  error: string | null;
  history: AIHistoryEntry[];
  refresh: () => void;
};
export function useAITradingAssistant(
  facts: RuleBasedSetup | null,
  mode: ExplanationMode,
): AssistantState {
  const [result, setResult] = useState<TradingAssistantResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [history, setHistory] = useState<AIHistoryEntry[]>([]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setHistory(
          JSON.parse(
            window.localStorage.getItem("ai-trading-ai-history") ?? "[]",
          ) as AIHistoryEntry[],
        );
      } catch {
        window.localStorage.removeItem("ai-trading-ai-history");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!facts) return;
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      const started = performance.now();
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facts, mode, refresh: refreshVersion > 0 }),
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          ok: boolean;
          data: TradingAssistantResult | null;
          message?: string;
        };
        if (!active) return;
        if (!response.ok || !body.ok || !body.data)
          throw new Error(body.message ?? "AI analysis unavailable");
        setResult(body.data);
        reportPerformanceMetric("AI analysis", performance.now() - started);
        const entry: AIHistoryEntry = {
          timestamp: body.data.generatedAt,
          symbol: facts.symbol,
          price: facts.price,
          preference: facts.preference,
          setupScore: facts.setupScore,
          technicalPreference: facts.technicalPreference,
          technicalSetupScore: facts.technicalSetupScore,
          newsRisk: facts.newsRisk,
          reasons: body.data.analysis.reasons,
          support: facts.setup1H.support,
          resistance: facts.setup1H.resistance,
          entry: facts.riskReward.entry,
          stop: facts.riskReward.stop,
          target: facts.riskReward.target,
        };
        setHistory((current) => {
          if (current[0]?.timestamp === entry.timestamp) return current;
          const next = [entry, ...current].slice(0, 50);
          window.localStorage.setItem(
            "ai-trading-ai-history",
            JSON.stringify(next),
          );
          return next;
        });
      } catch (requestError) {
        if (active && (requestError as Error).name !== "AbortError")
          setError((requestError as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [facts, mode, refreshVersion]);
  const refresh = useCallback(
    () => setRefreshVersion((value) => value + 1),
    [],
  );
  return { result, loading, error, history, refresh };
}
export async function askTradingAssistant(
  question: string,
  facts: RuleBasedSetup,
  mode: ExplanationMode,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, facts, mode }),
    signal,
  });
  const body = (await response.json()) as {
    ok: boolean;
    data: {
      answer: string;
      source: "openai" | "rule-based";
      model: string | null;
      message?: string;
    } | null;
    message?: string;
  };
  if (!response.ok || !body.ok || !body.data)
    throw new Error(body.message ?? "Assistant chat unavailable");
  return body.data;
}
