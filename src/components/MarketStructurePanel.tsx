import { Activity, Braces, CircleAlert } from "lucide-react";
import { formatPrice, type MarketAsset } from "@/lib/market-data";
import { nearestZones, type MultiTimeframePatternAnalysis, type MultiTimeframeStructureAnalysis, type PatternDetection, type PatternSensitivity, type TimeframeStructureAnalysis } from "@/lib/analysis";
import type { DataSourceKind } from "@/lib/market-data/types";

function trendColor(trend?: string) { return trend === "bullish" ? "text-[#16c784]" : trend === "bearish" ? "text-[#ea3943]" : "text-amber-400"; }
function zoneRange(asset: MarketAsset, zone?: { low: number; high: number }) { return zone ? `${formatPrice(asset, zone.low)}–${formatPrice(asset, zone.high)}` : "Not confirmed"; }
function row(label: string, value: string, color = "text-[#cbd0d8]") { return <div className="flex items-start justify-between gap-3 border-b border-[#1c2028] py-2.5"><span className="text-[10px] text-[#687180]">{label}</span><span className={`max-w-[165px] text-right text-[10px] font-medium ${color}`}>{value}</span></div>; }

export function MarketStructurePanel({ asset, currentPrice, analysis, patterns, patternSensitivity, onPatternSensitivityChange, loading, error, source, provider }: { asset: MarketAsset; currentPrice: number; analysis: MultiTimeframeStructureAnalysis | null; patterns: MultiTimeframePatternAnalysis | null; patternSensitivity: PatternSensitivity; onPatternSensitivityChange: (value: PatternSensitivity) => void; loading: boolean; error: string | null; source: DataSourceKind; provider: string }) {
  const h4 = analysis?.byTimeframe["4H"]; const h1 = analysis?.byTimeframe["1H"]; const m15 = analysis?.byTimeframe["15m"];
  const reference = h1 ?? h4 ?? m15; const zones = reference ? nearestZones(reference.zones.filter((zone) => zone.touches >= 2), currentPrice) : { support: undefined, resistance: undefined };
  const reversal = h1?.roleReversals[0] ?? m15?.roleReversals[0] ?? h4?.roleReversals[0];
  return <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-[#20242d] bg-[#0c0f14] xl:block thin-scrollbar">
    <div className="flex h-10 items-center gap-2 border-b border-[#20242d] px-4"><Activity size={14} className="text-blue-400"/><span className="text-[10px] font-bold tracking-[.15em] text-[#aab1bd]">MARKET STRUCTURE</span><span className={`ml-auto size-1.5 rounded-full ${error ? "bg-[#ea3943]" : loading ? "animate-pulse bg-amber-400" : "bg-[#16c784] shadow-[0_0_7px_#16c784]"}`} /></div>
    <div className="p-4"><div className="mb-4 flex items-center justify-between"><div><div className="text-[9px] font-semibold tracking-[.18em] text-[#657080]">AUTOMATIC ANALYSIS</div><div className="mt-1 text-xs font-semibold text-white">{asset.symbol}</div></div><span className={`border px-1.5 py-1 text-[8px] font-bold ${source === "LIVE" ? "border-emerald-500/30 text-[#16c784]" : "border-amber-500/30 text-amber-400"}`}>{source} · {provider}</span></div>
      {loading && !analysis ? <div className="grid h-64 place-items-center text-[10px] text-[#687180]">Calculating confirmed structure…</div> : error && !analysis ? <div className="grid h-64 place-items-center text-center"><div><CircleAlert size={18} className="mx-auto text-[#ea3943]"/><div className="mt-2 text-[10px] text-[#8d96a5]">{error}</div></div></div> : <>
        <div className="border-t border-[#20242d]">
          {row("4H Trend", h4 ? `${h4.trend.trend} · ${h4.trend.confidence}%` : "Unavailable", trendColor(h4?.trend.trend))}
          {row("4H Structure", h4?.latestStructure ?? "Unavailable", "text-blue-400")}
          {row("1H Structure", h1?.latestStructure ?? "Unavailable", "text-blue-400")}
          {row("15M Structure", m15 ? `${m15.latestStructure} · ${m15.trend.trend}` : "Unavailable", trendColor(m15?.trend.trend))}
          {row("Nearest Support", zoneRange(asset, zones.support), "text-[#16c784]")}
          {row("Nearest Resistance", zoneRange(asset, zones.resistance), "text-[#ea3943]")}
          {row("Role Reversal", reversal?.label ?? "None confirmed", reversal ? "text-violet-400" : "text-[#687180]")}
        </div>
        <div className="mt-4 border border-blue-500/20 bg-blue-500/[.05] p-3 text-[9px] leading-4 text-[#7f91aa]">Only confirmed candles and confirmed pivots are analyzed. The currently forming candle is excluded.</div>
        <RecentPatterns patterns={patterns} sensitivity={patternSensitivity} onSensitivityChange={onPatternSensitivityChange} />
        {process.env.NODE_ENV !== "production" && analysis && <DebugPanel analysis={analysis} patterns={patterns} />}
      </>}
    </div>
  </aside>;
}

function RecentPatterns({ patterns, sensitivity, onSensitivityChange }: { patterns: MultiTimeframePatternAnalysis | null; sensitivity: PatternSensitivity; onSensitivityChange: (value: PatternSensitivity) => void }) {
  return <section className="mt-5">
    <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-bold tracking-[.15em] text-[#8c95a3]">PATTERN RELIABILITY</span><span className="flex border border-[#252b35]">{(["low", "medium", "high"] as PatternSensitivity[]).map((value) => <button key={value} title={`${value} detection sensitivity`} onClick={() => onSensitivityChange(value)} className={`px-1.5 py-1 text-[7px] font-bold uppercase ${sensitivity === value ? "bg-fuchsia-500/15 text-fuchsia-400" : "text-[#596170] hover:text-white"}`}>{value[0]}</button>)}</span></div>
    <div className="border-t border-[#20242d]">{(["4H", "1H", "15m"] as const).map((timeframe) => { const pattern = patterns?.byTimeframe[timeframe]?.mostRelevant; const reliability = pattern?.reliability; return <div key={timeframe} className="flex gap-3 border-b border-[#1c2028] py-2.5"><span className="w-7 shrink-0 text-[9px] font-bold text-[#596170]">{timeframe.toUpperCase()}</span>{pattern ? <div className="min-w-0 flex-1"><div className={`truncate text-[10px] font-semibold ${pattern.direction === "bullish" ? "text-[#16c784]" : pattern.direction === "bearish" ? "text-[#ea3943]" : "text-violet-400"}`}>{pattern.name}</div><div className="mt-1 text-[8px] text-[#697281]">Score {pattern.confidence} · {pattern.status} · {pattern.context}</div>{reliability && <div className="mt-1 flex flex-wrap gap-x-2 text-[7px] text-[#7d8796]"><span className={reliability.volumeConfirmed ? "text-emerald-400" : ""}>Vol {reliability.volumeRatio.toFixed(2)}×</span><span>ATR {reliability.atrRatio.toFixed(2)}×</span><span>{reliability.session}</span>{reliability.historicalWinRate !== null && <span>Hist {reliability.historicalWinRate}%/{reliability.historicalSamples}</span>}{reliability.cluster.length > 0 && <span className="text-fuchsia-400">Cluster {reliability.cluster.length + 1}</span>}</div>}</div> : <span className="text-[9px] text-[#596170]">No strong pattern</span>}</div>; })}</div>
    {patterns?.setupConditions.length ? <div className="mt-3 border border-violet-500/20 bg-violet-500/[.05] p-2.5"><div className="text-[8px] font-bold tracking-wider text-violet-400">SETUP CONDITIONS</div>{patterns.setupConditions.map((condition) => <div key={condition} className="mt-1.5 text-[9px] leading-4 text-[#8f96a3]">{condition}</div>)}</div> : null}
  </section>;
}

function DebugPanel({ analysis, patterns }: { analysis: MultiTimeframeStructureAnalysis; patterns: MultiTimeframePatternAnalysis | null }) {
  const latestPatterns = Object.values(patterns?.byTimeframe ?? {}).flatMap((item) => item?.patterns.slice(0, 2) ?? []) as PatternDetection[];
  return <details className="mt-4 border border-[#252b35] bg-[#090c11]"><summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[9px] font-bold tracking-wider text-[#7d8796]"><Braces size={12}/>ANALYSIS DEBUG</summary><div className="max-h-80 space-y-3 overflow-y-auto border-t border-[#252b35] p-3 font-mono text-[8px] leading-4 text-[#687180]">{Object.entries(analysis.byTimeframe).map(([timeframe, value]) => { const item = value as TimeframeStructureAnalysis; return <div key={timeframe}><div className="font-bold text-blue-400">{timeframe} · trend {item.trend.confidence}</div><div>swings: {item.swings.slice(-8).map((point) => `${point.type[0].toUpperCase()}@${point.price.toPrecision(6)}`).join(" · ") || "none"}</div><div>labels: {item.labels.slice(-10).map((point) => point.label).join(" ") || "none"}</div><div>zones: {item.zones.map((zone) => `${zone.type[0].toUpperCase()}[${zone.touches}/${zone.strength}]`).join(" ") || "none"}</div></div>; })}{latestPatterns.map((pattern) => <div key={pattern.id} className="border-t border-[#20242d] pt-2"><div className="font-bold text-fuchsia-400">{pattern.timeframe} {pattern.name} · {pattern.status}</div><div>body {pattern.debug.bodyRatio.toFixed(2)} · upper {pattern.debug.upperWickRatio.toFixed(2)} · lower {pattern.debug.lowerWickRatio.toFixed(2)}</div><div>range {pattern.debug.range.toPrecision(5)} · avg {pattern.debug.averageRange.toPrecision(5)}</div><div>raw {pattern.debug.shapeScore} · context {pattern.debug.locationScore.toFixed(0)} · trend {pattern.debug.trendAlignmentScore.toFixed(0)} · final {pattern.debug.finalScore}</div></div>)}</div></details>;
}
