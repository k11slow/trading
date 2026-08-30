import type { Candle } from "@/lib/market-data/types";
import { analyzeTimeframe, detectCandlestickPatterns } from "@/lib/analysis";
import type { BacktestBreakdown, BacktestConfig, BacktestResult, BacktestSignal, BacktestTrade } from "./types";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
function atr(candles: Candle[], index: number, period = 14) {
  const sample = candles.slice(Math.max(0, index - period + 1), index + 1);
  return sample.reduce((sum, candle) => sum + candle.high - candle.low, 0) / Math.max(1, sample.length);
}
function breakdown(trades: BacktestTrade[], key: (trade: BacktestTrade) => string): BacktestBreakdown[] {
  const groups = new Map<string, BacktestTrade[]>();
  trades.forEach((trade) => groups.set(key(trade), [...(groups.get(key(trade)) ?? []), trade]));
  return [...groups].map(([name, rows]) => { const wins = rows.filter((trade) => trade.result === "WIN").length; const netR = rows.reduce((sum, trade) => sum + trade.netR, 0); return { name, trades: rows.length, wins, winRate: round(wins / rows.length * 100), expectancyR: round(netR / rows.length), netR: round(netR) }; }).sort((a, b) => b.expectancyR - a.expectancyR || b.trades - a.trades);
}

export function generateBacktestSignals(candles: Candle[], config: BacktestConfig): BacktestSignal[] {
  const signals: BacktestSignal[] = [];
  for (let index = 40; index < candles.length - config.maximumHoldCandles - 1; index++) {
    const window = candles.slice(0, index + 2); const structure = analyzeTimeframe(window, config.timeframe);
    const patterns = detectCandlestickPatterns(window, config.timeframe, structure, { sensitivity: "medium", includeForming: false, majorTrend: structure.trend.trend, lookback: 0 });
    const best = patterns.filter((pattern) => pattern.candleIndex === index && pattern.status === "confirmed" && pattern.direction !== "neutral" && pattern.confidence >= config.minimumConfidence).sort((a, b) => b.confidence - a.confidence)[0];
    if (best) signals.push({ candleIndex: index, pattern: best.name, direction: best.direction as "bullish" | "bearish", confidence: best.confidence, session: best.reliability?.session ?? "Off-hours" });
  }
  return signals;
}

export function simulateBacktest(candles: Candle[], signals: BacktestSignal[], config: BacktestConfig): BacktestResult {
  const trades: BacktestTrade[] = []; let nextAvailableIndex = 0;
  for (const signal of signals) {
    const entryIndex = signal.candleIndex + 1; const entryCandle = candles[entryIndex]; if (!entryCandle || entryIndex < nextAvailableIndex) continue;
    const range = atr(candles, signal.candleIndex); if (!(range > 0)) continue;
    const bullish = signal.direction === "bullish"; const rawEntry = entryCandle.open; const slippage = rawEntry * config.slippageBps / 10_000; const entry = rawEntry + (bullish ? slippage : -slippage); const risk = range * config.stopAtr;
    const stop = entry + (bullish ? -risk : risk); const target = entry + (bullish ? range * config.targetAtr : -range * config.targetAtr); const finalIndex = Math.min(candles.length - 1, entryIndex + config.maximumHoldCandles - 1); let exit = candles[finalIndex].close; let exitIndex = finalIndex; let result: BacktestTrade["result"] = "TIME_EXIT";
    for (let index = entryIndex; index <= finalIndex; index++) {
      const candle = candles[index]; const stopped = bullish ? candle.low <= stop : candle.high >= stop; const targeted = bullish ? candle.high >= target : candle.low <= target;
      if (stopped) { exit = stop; exitIndex = index; result = "LOSS"; break; }
      if (targeted) { exit = target; exitIndex = index; result = "WIN"; break; }
    }
    const grossR = (bullish ? exit - entry : entry - exit) / risk; const tradingCost = (entry + exit) * config.feesBps / 10_000 + exit * config.slippageBps / 10_000; const netR = grossR - tradingCost / risk;
    trades.push({ pattern: signal.pattern, direction: signal.direction, session: signal.session, confidence: signal.confidence, signalTime: candles[signal.candleIndex].time, entryTime: entryCandle.time, exitTime: candles[exitIndex].time, entry, stop, target, exit, result, grossR: round(grossR, 4), netR: round(netR, 4), heldCandles: exitIndex - entryIndex + 1 });
    nextAvailableIndex = exitIndex + 1;
  }
  const wins = trades.filter((trade) => trade.result === "WIN").length; const losses = trades.filter((trade) => trade.result === "LOSS").length; const gains = trades.filter((trade) => trade.netR > 0).reduce((sum, trade) => sum + trade.netR, 0); const negative = Math.abs(trades.filter((trade) => trade.netR < 0).reduce((sum, trade) => sum + trade.netR, 0)); const netR = trades.reduce((sum, trade) => sum + trade.netR, 0);
  let equity = 0; let peak = 0; let maximumDrawdownR = 0; for (const trade of trades) { equity += trade.netR; peak = Math.max(peak, equity); maximumDrawdownR = Math.max(maximumDrawdownR, peak - equity); }
  return { config, generatedAt: Date.now(), candles: candles.length, signals: signals.length, trades, metrics: { trades: trades.length, wins, losses, timeExits: trades.length - wins - losses, winRate: trades.length ? round(wins / trades.length * 100) : 0, profitFactor: negative > 0 ? round(gains / negative) : gains > 0 ? null : 0, expectancyR: trades.length ? round(netR / trades.length) : 0, netR: round(netR), maximumDrawdownR: round(maximumDrawdownR) }, byPattern: breakdown(trades, (trade) => trade.pattern), bySession: breakdown(trades, (trade) => trade.session), warning: trades.length < 30 ? "Small sample: treat these results as exploratory until at least 30 trades are available." : null };
}

export function runPatternBacktest(candles: Candle[], config: BacktestConfig) { return simulateBacktest(candles, generateBacktestSignals(candles, config), config); }
