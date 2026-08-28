import type { Candle, Timeframe } from "@/lib/market-data/types";
import { averageTrueRange } from "./swings";
import type { RoleReversal, SupportResistanceZone, SwingPoint, ZoneType } from "./types";

const timeframeWeight: Record<Timeframe, number> = { "15m": .85, "1H": 1, "4H": 1.2, "1D": 1.4 };

export function buildSupportResistanceZones(candles: Candle[], swings: SwingPoint[], timeframe: Timeframe, maxPerType = 4): SupportResistanceZone[] {
  if (!candles.length || !swings.length) return [];
  const atr = averageTrueRange(candles, Math.min(50, candles.length - 1)); const price = candles.at(-1)!.close; const clusterDistance = Math.max(atr * .55, price * .0012); const indexByTime = new Map(candles.map((candle, index) => [candle.time, index]));
  const makeZones = (type: ZoneType) => {
    const relevant = swings.filter((point) => point.type === (type === "support" ? "low" : "high")).sort((a, b) => a.price - b.price);
    const clusters: SwingPoint[][] = [];
    for (const point of relevant) { const cluster = clusters.find((items) => Math.abs(items.reduce((sum, item) => sum + item.price, 0) / items.length - point.price) <= clusterDistance); if (cluster) cluster.push(point); else clusters.push([point]); }
    return clusters.map((points, clusterIndex) => {
      const prices = points.map((point) => point.price); const lastTouchedAt = Math.max(...points.map((point) => point.time)); const lastIndex = indexByTime.get(lastTouchedAt) ?? 0;
      const reaction = points.reduce((sum, point) => { const future = candles.slice(point.index + 1, point.index + 5); if (!future.length || !atr) return sum; const distance = type === "support" ? Math.max(...future.map((item) => item.high)) - point.price : point.price - Math.min(...future.map((item) => item.low)); return sum + Math.max(0, distance / atr); }, 0) / points.length;
      const recency = 1 - Math.min(1, (candles.length - 1 - lastIndex) / candles.length); const strength = Math.round(Math.min(100, points.length * 16 + recency * 22 + Math.min(3, reaction) * 9) * timeframeWeight[timeframe]); const padding = clusterDistance * .15;
      return { id: `${timeframe}-${type}-${clusterIndex}-${Math.round(lastTouchedAt)}`, type, low: Math.min(...prices) - padding, high: Math.max(...prices) + padding, midpoint: (Math.min(...prices) + Math.max(...prices)) / 2, strength: Math.min(100, strength), touches: points.length, lastTouchedAt } satisfies SupportResistanceZone;
    }).sort((a, b) => b.strength - a.strength || b.lastTouchedAt - a.lastTouchedAt).slice(0, maxPerType);
  };
  return [...makeZones("support"), ...makeZones("resistance")];
}

export function detectRoleReversals(candles: Candle[], zones: SupportResistanceZone[], toleranceRatio = .0008): RoleReversal[] {
  const reversals: RoleReversal[] = [];
  for (const zone of zones) {
    const tolerance = zone.midpoint * toleranceRatio; let breakIndex = -1; const formedIndex = candles.findIndex((candle) => candle.time >= zone.lastTouchedAt);
    for (let index = Math.max(1, formedIndex + 1); index < candles.length; index++) {
      const previousWasOriginalSide = zone.type === "support" ? candles[index - 1].close >= zone.low - tolerance : candles[index - 1].close <= zone.high + tolerance;
      const confirmedClose = zone.type === "support" ? candles[index].close < zone.low - tolerance : candles[index].close > zone.high + tolerance;
      if (previousWasOriginalSide && confirmedClose) { breakIndex = index; break; }
    }
    if (breakIndex < 0) continue;
    for (let index = breakIndex + 2; index < candles.length; index++) {
      const candle = candles[index]; const touched = candle.high >= zone.low - tolerance && candle.low <= zone.high + tolerance;
      const heldNewSide = zone.type === "support" ? candle.close < zone.midpoint : candle.close > zone.midpoint;
      if (touched && heldNewSide) { const supportBroken = zone.type === "support"; reversals.push({ zoneId: zone.id, originalType: zone.type, newType: supportBroken ? "resistance" : "support", brokenAt: candles[breakIndex].time, retestedAt: candle.time, label: supportBroken ? "Old Support → New Resistance" : "Old Resistance → New Support" }); break; }
    }
  }
  return reversals.sort((a, b) => b.retestedAt - a.retestedAt);
}

export function nearestZones(zones: SupportResistanceZone[], currentPrice: number) {
  const support = zones.filter((zone) => zone.type === "support" && zone.midpoint <= currentPrice).sort((a, b) => b.midpoint - a.midpoint)[0] ?? zones.filter((zone) => zone.type === "support").sort((a, b) => Math.abs(a.midpoint - currentPrice) - Math.abs(b.midpoint - currentPrice))[0];
  const resistance = zones.filter((zone) => zone.type === "resistance" && zone.midpoint >= currentPrice).sort((a, b) => a.midpoint - b.midpoint)[0] ?? zones.filter((zone) => zone.type === "resistance").sort((a, b) => Math.abs(a.midpoint - currentPrice) - Math.abs(b.midpoint - currentPrice))[0];
  return { support, resistance };
}
