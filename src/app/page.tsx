"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Sidebar, type SidebarView } from "@/components/Sidebar";
import { MarketTabs } from "@/components/MarketTabs";
import { Watchlist } from "@/components/Watchlist";
import { TradingChart } from "@/components/TradingChart";
import { AITradingAssistantPanel } from "@/components/AITradingAssistantPanel";
import { BottomPanel } from "@/components/BottomPanel";
import {
  findAsset,
  marketCatalog,
  normalizeMarketAsset,
  type IndicatorKey,
  type MarketAsset,
  type MarketCategory,
  type Timeframe,
} from "@/lib/market-data";
import {
  useMarketQuote,
  useMultiTimeframeStructure,
} from "@/hooks/use-market-data";
import type { PatternSensitivity } from "@/lib/analysis";
import { memoizedCalculateSetup, type ExplanationMode } from "@/lib/ai";
import { useAITradingAssistant } from "@/hooks/use-ai-assistant";
import { useNewsContext } from "@/hooks/use-news-context";
import { MarketsWorkspace } from "@/components/MarketsWorkspace";
import { ToolWorkspace } from "@/components/ToolWorkspace";
import { PerformanceDebug } from "@/components/PerformanceDebug";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { BuyAlertSettingsPanel, BuyAlertToast } from "@/components/BuyAlertUI";
import { useBuyAlerts } from "@/hooks/use-buy-alerts";
import { SimpleTradingView } from "@/components/SimpleTradingView";

type Workspace = {
  version: number;
  category: MarketCategory;
  symbol: string;
  timeframe: Timeframe;
  indicators: IndicatorKey[];
  patternSensitivity: PatternSensitivity;
  explanationMode: ExplanationMode;
};
const defaults: Workspace = {
  version: 6,
  category: "Forex",
  symbol: "EUR/USD",
  timeframe: "1H",
  indicators: ["ema20", "volume", "levels", "structure", "patterns"],
  patternSensitivity: "medium",
  explanationMode: "beginner",
};
const defaultFavorites = [
  "EUR/USD",
  "XAU/USD",
  "BTC/USDT",
  "AAPL",
  "DOGE/USDT",
].map(findAsset);

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>(defaults);
  const [sidebarView, setSidebarView] = useState<SidebarView>("Watchlist");
  const [dynamicAsset, setDynamicAsset] = useState<MarketAsset | null>(null);
  const [favorites, setFavorites] = useState<MarketAsset[]>(defaultFavorites);
  const [analysisSymbol, setAnalysisSymbol] = useState("");
  const [newsSymbol, setNewsSymbol] = useState("");
  const [buyAlertSettingsOpen, setBuyAlertSettingsOpen] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const skipFirstPersist = useRef(true);
  const asset =
    dynamicAsset?.symbol === workspace.symbol
      ? dynamicAsset
      : findAsset(workspace.symbol);
  const quote = useMarketQuote(asset);
  const limitedHistory = !!asset.insufficientHistory;
  const structureEnabled = analysisSymbol === asset.symbol && !limitedHistory;
  const structure = useMultiTimeframeStructure(
    asset,
    workspace.patternSensitivity,
    structureEnabled,
  );
  const news = useNewsContext(asset, newsSymbol === asset.symbol);
  const setupFacts = useMemo(
    () =>
      quote.data?.symbol === asset.symbol &&
      structure.analysis?.symbol === asset.symbol &&
      structure.patterns?.symbol === asset.symbol
        ? memoizedCalculateSetup({
            asset,
            quote: quote.data,
            structure: structure.analysis,
            patterns: structure.patterns,
            newsRisk:
              news.data?.symbol === asset.symbol ? news.data.risk : null,
          })
        : null,
    [asset, news.data, quote.data, structure.analysis, structure.patterns],
  );
  const assistant = useAITradingAssistant(
    setupFacts,
    workspace.explanationMode,
  );
  const buyAlerts = useBuyAlerts(setupFacts);
  useEffect(() => {
    const saved = window.localStorage.getItem("ai-trading-simple-mode");
    if (saved !== "false") return;
    const frame = window.requestAnimationFrame(() => setSimpleMode(false));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const analysisTimer = window.setTimeout(
      () => setAnalysisSymbol(asset.symbol),
      350,
    );
    const newsTimer = window.setTimeout(
      () => setNewsSymbol(asset.symbol),
      1_200,
    );
    return () => {
      window.clearTimeout(analysisTimer);
      window.clearTimeout(newsTimer);
    };
  }, [asset.symbol]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem("ai-trading-favorites") ?? "[]",
      ) as MarketAsset[];
      if (saved.length) {
        const normalized = saved.slice(0, 30).map(normalizeMarketAsset);
        const frame = requestAnimationFrame(() =>
          setFavorites(normalized),
        );
        window.localStorage.setItem(
          "ai-trading-favorites",
          JSON.stringify(normalized),
        );
        return () => cancelAnimationFrame(frame);
      }
    } catch {
      window.localStorage.removeItem("ai-trading-favorites");
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("ai-trading-workspace");
    if (!stored) return;
    let frame: number | undefined;
    try {
      const saved = JSON.parse(stored) as Workspace;
      const normalizedSymbol =
        saved.category === "Forex"
          ? normalizeMarketAsset({
              ...findAsset(saved.symbol),
              symbol: saved.symbol,
              category: "Forex",
            }).symbol
          : saved.symbol;
      if (
        saved.version === defaults.version &&
        marketCatalog[saved.category]?.some(
          (item) => item.symbol === normalizedSymbol,
        )
      )
        frame = window.requestAnimationFrame(() =>
          setWorkspace({ ...saved, symbol: normalizedSymbol }),
        );
    } catch {
      window.localStorage.removeItem("ai-trading-workspace");
    }
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    window.localStorage.setItem(
      "ai-trading-workspace",
      JSON.stringify(workspace),
    );
  }, [workspace]);

  const changeCategory = (category: MarketCategory) => {
    setWorkspace((current) => ({
      ...current,
      category,
      symbol: marketCatalog[category][0].symbol,
    }));
    setSidebarView("Watchlist");
  };
  const selectAsset = (next: MarketAsset) => {
    setDynamicAsset(next);
    setWorkspace((current) => ({
      ...current,
      category: next.category,
      symbol: next.symbol,
    }));
  };
  const toggleFavorite = (next: MarketAsset) =>
    setFavorites((current) => {
      const exists = current.some(
        (item) =>
          item.symbol === next.symbol && item.category === next.category,
      );
      const updated = exists
        ? current.filter(
            (item) =>
              item.symbol !== next.symbol || item.category !== next.category,
          )
        : [...current, next].slice(-30);
      window.localStorage.setItem(
        "ai-trading-favorites",
        JSON.stringify(updated),
      );
      return updated;
    });
  const toggleIndicator = (key: IndicatorKey) =>
    setWorkspace((current) => ({
      ...current,
      indicators: current.indicators.includes(key)
        ? current.indicators.filter((item) => item !== key)
        : [...current.indicators, key],
    }));
  const indicators = useMemo(
    () => new Set(workspace.indicators),
    [workspace.indicators],
  );

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#080a0e] text-[#d9dee7]">
      <PerformanceDebug />
      <BuyAlertSettingsPanel alerts={buyAlerts} open={buyAlertSettingsOpen} onClose={() => setBuyAlertSettingsOpen(false)} />
      <BuyAlertToast alerts={buyAlerts} onView={() => setSidebarView("Watchlist")} />
      <Header
        asset={asset}
        quote={quote.data}
        timeframe={workspace.timeframe}
        indicators={indicators}
        onTimeframeChange={(timeframe) =>
          setWorkspace((current) => ({ ...current, timeframe }))
        }
        onToggleIndicator={toggleIndicator}
        favorites={favorites}
        onSelectAsset={selectAsset}
        onOpenBuyAlerts={() => setBuyAlertSettingsOpen(true)}
      />
      <MarketTabs active={workspace.category} onChange={changeCategory} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-12 lg:flex-row lg:overflow-hidden lg:pb-0 thin-scrollbar">
        {simpleMode ? <SimpleTradingView asset={asset} quote={quote.data} facts={setupFacts} candles={structure.recentCandles} loading={quote.loading || structure.loading} error={quote.error ?? structure.error} onOpenPro={() => { setSimpleMode(false); window.localStorage.setItem("ai-trading-simple-mode", "false"); }}/> : <>
        <Sidebar active={sidebarView} onChange={setSidebarView} />
        {sidebarView === "Watchlist" && (
          <Watchlist
            assets={favorites}
            selected={asset.symbol}
            onSelect={selectAsset}
            onRemove={toggleFavorite}
          />
        )}
        {sidebarView === "Markets" ? (
          <PanelErrorBoundary name="Markets scanner">
            <MarketsWorkspace
              currentFacts={setupFacts}
              favorites={favorites}
              onSelect={selectAsset}
              onToggleFavorite={toggleFavorite}
              onClose={() => setSidebarView("Watchlist")}
            />
          </PanelErrorBoundary>
        ) : sidebarView !== "Watchlist" ? (
          <ToolWorkspace
            view={sidebarView}
            asset={asset}
            facts={setupFacts}
            indicators={indicators}
            onToggleIndicator={toggleIndicator}
            onClose={() => setSidebarView("Watchlist")}
          />
        ) : (
          <>
            <PanelErrorBoundary name="Chart">
              <section className="flex min-h-[560px] min-w-0 shrink-0 flex-col border-l border-[#20242d] lg:min-h-0 lg:flex-1 lg:shrink">
                <TradingChart
                  key={`${asset.symbol}-${workspace.timeframe}`}
                  asset={asset}
                  timeframe={workspace.timeframe}
                  indicators={indicators}
                  patterns={
                    structure.patterns?.byTimeframe[workspace.timeframe]
                      ?.patterns
                  }
                  patternSensitivity={workspace.patternSensitivity}
                />
                <BottomPanel
                  history={assistant.history}
                  newsContext={news.data}
                  alerts={buyAlerts.history}
                />
              </section>
            </PanelErrorBoundary>
            <PanelErrorBoundary name="AI coach">
              <AITradingAssistantPanel
                asset={asset}
                facts={setupFacts}
                result={assistant.result}
                loading={assistant.loading || (structureEnabled && structure.loading)}
                error={limitedHistory ? "INSUFFICIENT DATA — Limited-history analysis: this token is too new for reliable 4H → 1H → 15M structure." : assistant.error ?? structure.error}
                mode={workspace.explanationMode}
                onModeChange={(explanationMode) =>
                  setWorkspace((current) => ({ ...current, explanationMode }))
                }
                onRefresh={assistant.refresh}
                patternSensitivity={workspace.patternSensitivity}
                onPatternSensitivityChange={(patternSensitivity) =>
                  setWorkspace((current) => ({
                    ...current,
                    patternSensitivity,
                  }))
                }
                recentCandles={structure.recentCandles}
                patternAnalysis={structure.patterns}
                debug={{
                  source: structure.source,
                  provider: structure.provider,
                  timeframe: workspace.timeframe,
                  lastCandleTimestamp:
                    structure.analysis?.byTimeframe[workspace.timeframe]
                      ?.analyzedThrough,
                }}
              />
            </PanelErrorBoundary>
          </>
        )}
        <button onClick={() => { setSimpleMode(true); window.localStorage.setItem("ai-trading-simple-mode", "true"); }} className="fixed bottom-14 right-2 z-40 border border-blue-500/30 bg-[#101722] px-3 py-2 text-[9px] font-bold text-blue-300 lg:bottom-3">SIMPLE MODE</button>
        </>}
      </div>
    </main>
  );
}
