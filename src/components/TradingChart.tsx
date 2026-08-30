"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Timer } from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  calculateEma,
  formatPrice,
  pricePrecision,
  type IndicatorKey,
  type MarketAsset,
  type Timeframe,
} from "@/lib/market-data";
import { useMarketCandles } from "@/hooks/use-market-data";
import { validateCandles } from "@/lib/market-data/validation";
import {
  detectCandlestickPatterns,
  memoizedTimeframeAnalysis,
  type PatternDetection,
  type PatternSensitivity,
} from "@/lib/analysis";
import { reportPerformanceMetric } from "@/lib/performance";
import {
  formatCandleCountdown,
  secondsUntilCandleClose,
} from "@/lib/timeframe-countdown";

type Ohlc = Pick<
  CandlestickData<UTCTimestamp>,
  "open" | "high" | "low" | "close"
>;

export function TradingChart({
  asset,
  timeframe,
  indicators,
  patterns,
  patternSensitivity,
}: {
  asset: MarketAsset;
  timeframe: Timeframe;
  indicators: Set<IndicatorKey>;
  patterns?: PatternDetection[];
  patternSensitivity: PatternSensitivity;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const fittedRef = useRef(false);
  const market = useMarketCandles(asset, timeframe);
  const [crosshair, setCrosshair] = useState<Ohlc | null>(null);
  const [selectedPattern, setSelectedPattern] =
    useState<PatternDetection | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const validatedCandles = useMemo(
    () => validateCandles(market.data ?? [], asset).candles,
    [asset, market.data],
  );
  const candles = useMemo(
    () =>
      validatedCandles.map((bar) => ({
        ...bar,
        time: bar.time as UTCTimestamp,
      })),
    [validatedCandles],
  );
  const structureAnalysis = useMemo(
    () => memoizedTimeframeAnalysis(asset.symbol, validatedCandles, timeframe),
    [asset.symbol, validatedCandles, timeframe],
  );
  const localPatterns = useMemo(
    () =>
      validatedCandles.length
        ? detectCandlestickPatterns(
            validatedCandles,
            timeframe,
            structureAnalysis,
            {
              majorTrend: structureAnalysis.trend.trend,
              sensitivity: patternSensitivity,
            },
          )
        : [],
    [validatedCandles, timeframe, structureAnalysis, patternSensitivity],
  );
  const visiblePatterns = patterns ?? localPatterns;
  const displayed = crosshair ?? candles.at(-1) ?? null;

  useEffect(() => {
    const updateCountdown = () =>
      setCountdown(secondsUntilCandleClose(timeframe, Date.now()));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(timer);
  }, [timeframe]);

  useEffect(() => {
    const started = performance.now();
    const container = chartRef.current;
    if (!container || !candles.length) return;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#090c11" },
        textColor: "#687180",
        fontSize: 10,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      },
      grid: {
        vertLines: { color: "#151a21" },
        horzLines: { color: "#151a21" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#4d5666",
          width: 1,
          style: 3,
          labelBackgroundColor: "#29313d",
        },
        horzLine: {
          color: "#4d5666",
          width: 1,
          style: 3,
          labelBackgroundColor: "#29313d",
        },
      },
      rightPriceScale: {
        borderColor: "#242a33",
        scaleMargins: {
          top: 0.13,
          bottom: indicators.has("volume") ? 0.22 : 0.1,
        },
      },
      timeScale: {
        borderColor: "#242a33",
        timeVisible: timeframe !== "1D",
        secondsVisible: false,
        rightOffset: 7,
        barSpacing: timeframe === "15m" ? 7 : 8,
        minBarSpacing: 3,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });
    const precision = pricePrecision(asset, candles.at(-1)?.close);
    const minMove = 10 ** -precision;
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#16c784",
      downColor: "#ea3943",
      borderUpColor: "#16c784",
      borderDownColor: "#ea3943",
      wickUpColor: "#16c784",
      wickDownColor: "#ea3943",
      priceFormat: { type: "price", precision, minMove },
    });
    candleSeries.setData(candles);
    if (indicators.has("ema20")) {
      const ema = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ema.setData(calculateEma(candles, 20));
    }
    if (indicators.has("ema50")) {
      const ema = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ema.setData(calculateEma(candles, 50));
    }
    if (indicators.has("volume")) {
      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volume
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      const volumeData: HistogramData<UTCTimestamp>[] = candles.map((bar) => ({
        time: bar.time,
        value: bar.volume ?? 0,
        color: bar.close >= bar.open ? "#16c78442" : "#ea394342",
      }));
      volume.setData(volumeData);
    }
    if (indicators.has("levels"))
      [
        ...structureAnalysis.zones
          .filter((zone) => zone.touches >= 2 && zone.type === "support")
          .sort(
            (a, b) =>
              Math.abs(a.midpoint - candles.at(-1)!.close) -
              Math.abs(b.midpoint - candles.at(-1)!.close),
          )
          .slice(0, 2),
        ...structureAnalysis.zones
          .filter((zone) => zone.touches >= 2 && zone.type === "resistance")
          .sort(
            (a, b) =>
              Math.abs(a.midpoint - candles.at(-1)!.close) -
              Math.abs(b.midpoint - candles.at(-1)!.close),
          )
          .slice(0, 2),
      ].forEach((zone) => {
        const color = zone.type === "support" ? "#16c78488" : "#ea394388";
        candleSeries.createPriceLine({
          price: zone.low,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: "",
        });
        candleSeries.createPriceLine({
          price: zone.high,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${zone.type === "support" ? "Support" : "Resistance"} ${zone.strength}`,
        });
      });
    const selectedPatternMarkers = (() => {
      const unique = new Map<string, PatternDetection>();
      for (const pattern of [...visiblePatterns].sort(
        (a, b) => b.timestamp - a.timestamp || b.confidence - a.confidence,
      )) {
        const key = `${pattern.timestamp}:${pattern.direction === "bearish" ? "above" : "below"}`;
        if (!unique.has(key)) unique.set(key, pattern);
      }
      return [...unique.values()].slice(0, 5);
    })();
    const occupiedPatternPositions = new Set(
      selectedPatternMarkers.map(
        (pattern) =>
          `${pattern.timestamp}:${pattern.direction === "bearish" ? "above" : "below"}`,
      ),
    );
    if (indicators.has("structure"))
      createSeriesMarkers(
        candleSeries,
        structureAnalysis.labels
          .slice(-8)
          .filter(
            (point) =>
              !occupiedPatternPositions.has(
                `${point.time}:${point.type === "high" ? "above" : "below"}`,
              ),
          )
          .map((point) => ({
            time: point.time as UTCTimestamp,
            position:
              point.type === "high"
                ? ("aboveBar" as const)
                : ("belowBar" as const),
            color:
              point.label === "HH" || point.label === "HL"
                ? "#60a5fa"
                : "#f87171",
            shape: "circle" as const,
            text: point.label,
            size: 1,
          })),
      );
    else if (indicators.has("swings"))
      createSeriesMarkers(
        candleSeries,
        structureAnalysis.swings
          .slice(-18)
          .map((point) => ({
            time: point.time as UTCTimestamp,
            position:
              point.type === "high"
                ? ("aboveBar" as const)
                : ("belowBar" as const),
            color: "#8490a1",
            shape: "circle" as const,
            text: point.type === "high" ? "SH" : "SL",
            size: 0.7,
          })),
      );
    const patternMap = new Map(
      visiblePatterns.map((pattern) => [pattern.id, pattern]),
    );
    if (indicators.has("patterns"))
      createSeriesMarkers(
        candleSeries,
        selectedPatternMarkers
          .map((pattern) => ({
            id: pattern.id,
            time: pattern.timestamp as UTCTimestamp,
            position:
              pattern.direction === "bearish"
                ? ("aboveBar" as const)
                : ("belowBar" as const),
            color:
              pattern.status === "forming"
                ? "#e879f999"
                : pattern.direction === "bullish"
                  ? "#34d399"
                  : pattern.direction === "bearish"
                    ? "#fb7185"
                    : "#a78bfa",
            shape:
              pattern.direction === "bullish"
                ? ("arrowUp" as const)
                : pattern.direction === "bearish"
                  ? ("arrowDown" as const)
                  : ("square" as const),
            text: `${pattern.status === "forming" ? "?" : ""}${pattern.abbreviation === "LUW" ? "UW" : pattern.abbreviation === "LLW" ? "LW" : pattern.abbreviation}`,
            size: 0.8,
          })),
      );
    chart.subscribeCrosshairMove((param) => {
      const point = param.seriesData.get(candleSeries) as
        CandlestickData<UTCTimestamp> | undefined;
      if (point) setCrosshair(point);
      const id = param.hoveredInfo?.objectId;
      if (typeof id === "string" && patternMap.has(id))
        setSelectedPattern(patternMap.get(id)!);
    });
    chart.subscribeClick((param) => {
      const id = param.hoveredInfo?.objectId;
      if (typeof id === "string" && patternMap.has(id))
        setSelectedPattern(patternMap.get(id)!);
    });
    if (!fittedRef.current) {
      chart.timeScale().fitContent();
      fittedRef.current = true;
    }
    const observer = new ResizeObserver(([entry]) =>
      chart.resize(entry.contentRect.width, entry.contentRect.height),
    );
    observer.observe(container);
    const renderFrame = window.requestAnimationFrame(() =>
      reportPerformanceMetric("Chart render", performance.now() - started),
    );
    return () => {
      window.cancelAnimationFrame(renderFrame);
      observer.disconnect();
      chart.remove();
    };
  }, [
    asset,
    timeframe,
    indicators,
    candles,
    structureAnalysis,
    visiblePatterns,
  ]);

  const candleUp = displayed ? displayed.close >= displayed.open : true;
  return (
    <div className="relative min-h-[310px] flex-1 bg-[#090c11]">
      <div className="pointer-events-none absolute left-4 top-3 z-10">
        <div className="flex max-w-[calc(100vw-5rem)] flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-semibold text-[#d9dee7]">
            {asset.symbol}
          </span>
          <span className="text-[10px] text-[#596170]">
            · {timeframe} · {asset.exchange}
          </span>
          <span
            className={`border px-1.5 py-0.5 text-[8px] font-bold tracking-wider ${market.source === "LIVE" ? "border-emerald-500/30 bg-emerald-500/10 text-[#16c784]" : market.source === "MOCK" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-red-500/30 bg-red-500/10 text-[#ea3943]"}`}
          >
            {market.source === "LIVE"
              ? `LIVE • ${market.provider}`
              : market.source === "MOCK"
                ? "MOCK DATA"
                : "DATA UNAVAILABLE"}
          </span>
          {countdown !== null && (
            <span
              aria-label={`${formatCandleCountdown(countdown)} until the ${timeframe} candle closes`}
              className="flex items-center gap-1 border border-[#2b3340] bg-[#11161d]/90 px-1.5 py-0.5 font-mono text-[8px] font-semibold tabular-nums text-[#9ca6b5]"
              title={`Time until the current ${timeframe} candle closes`}
            >
              <Timer size={9} className="text-blue-400" />
              CLOSES IN {formatCandleCountdown(countdown)}
            </span>
          )}
        </div>
        {displayed && (
          <div className="mt-1 hidden gap-2 font-mono text-[9px] sm:flex">
            <span className="text-[#7b8492]">
              O {formatPrice(asset, displayed.open)}
            </span>
            <span className="text-[#16c784]">
              H {formatPrice(asset, displayed.high)}
            </span>
            <span className="text-[#ea3943]">
              L {formatPrice(asset, displayed.low)}
            </span>
            <span className={candleUp ? "text-[#16c784]" : "text-[#ea3943]"}>
              C {formatPrice(asset, displayed.close)}
            </span>
          </div>
        )}
        <div className="mt-2 hidden gap-3 text-[9px] md:flex">
          {indicators.has("ema20") && (
            <span className="text-blue-400">EMA 20</span>
          )}
          {indicators.has("ema50") && (
            <span className="text-amber-400">EMA 50</span>
          )}
          {indicators.has("volume") && (
            <span className="text-[#778191]">Volume</span>
          )}
          {indicators.has("levels") && (
            <span className="text-violet-400">S / R Zones</span>
          )}
          {indicators.has("structure") && (
            <span className="text-[#60a5fa]">Structure</span>
          )}
          {indicators.has("swings") && !indicators.has("structure") && (
            <span className="text-[#8490a1]">Swings</span>
          )}
          {indicators.has("patterns") && (
            <span className="text-fuchsia-400">Patterns</span>
          )}
        </div>
      </div>
      {indicators.has("trend") && (
        <div
          className={`pointer-events-none absolute right-16 top-3 z-10 border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${structureAnalysis.trend.trend === "bullish" ? "border-emerald-500/30 bg-emerald-500/10 text-[#16c784]" : structureAnalysis.trend.trend === "bearish" ? "border-red-500/30 bg-red-500/10 text-[#ea3943]" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}
        >
          {structureAnalysis.trend.trend} · {structureAnalysis.trend.confidence}
          %
        </div>
      )}
      {selectedPattern && indicators.has("patterns") && (
        <button
          onClick={() => setSelectedPattern(null)}
          className="absolute bottom-12 left-3 z-30 w-[min(16rem,calc(100vw-1.5rem))] border border-[#303744] bg-[#10151c]/95 p-3 text-left shadow-xl sm:left-4"
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-bold ${selectedPattern.direction === "bullish" ? "text-[#16c784]" : selectedPattern.direction === "bearish" ? "text-[#ea3943]" : "text-violet-400"}`}
            >
              {selectedPattern.name}
            </span>
            <span className="text-[9px] text-[#88919f]">
              {selectedPattern.confidence}/100
            </span>
          </div>
          <div className="mt-1 text-[8px] uppercase tracking-wider text-[#596170]">
            {selectedPattern.status} · {selectedPattern.context}
          </div>
          <div className="mt-2 text-[9px] leading-4 text-[#9ba4b2]">
            {selectedPattern.explanation}
          </div>
        </button>
      )}
      <div ref={chartRef} className="absolute inset-0" />
      {market.loading && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#090c11]/80">
          <div className="flex items-center gap-2 text-[11px] text-[#8c95a3]">
            <span className="size-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
            Loading {asset.symbol} market data…
          </div>
        </div>
      )}
      {!market.loading && market.error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#090c11]/90">
          <div className="text-center">
            <div className="text-xs font-semibold text-[#ea3943]">
              Data unavailable
            </div>
            <div className="mt-1 max-w-xs text-[10px] text-[#697281]">
              {market.error}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
