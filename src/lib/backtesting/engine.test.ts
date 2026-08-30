import { describe, expect, it } from "vitest";
import type { Candle } from "@/lib/market-data/types";
import { simulateBacktest, type BacktestConfig, type BacktestSignal } from ".";

const config: BacktestConfig = { symbol: "TEST", category: "Crypto", timeframe: "15m", minimumConfidence: 60, stopAtr: 1, targetAtr: 2, maximumHoldCandles: 3, feesBps: 0, slippageBps: 0 };
const candle = (time: number, open: number, high: number, low: number, close: number): Candle => ({ time, open, high, low, close, volume: 100 });
const base = Array.from({ length: 16 }, (_, index) => candle(index, 100, 100.5, 99.5, 100));
const signal = (overrides: Partial<BacktestSignal> = {}): BacktestSignal => ({ candleIndex: 10, pattern: "Bullish Engulfing", direction: "bullish", confidence: 80, session: "London", ...overrides });

describe("strategy backtest simulation", () => {
  it("uses the next candle open and records a target win", () => {
    const candles = [...base]; candles[11] = candle(11, 100, 102.2, 99.8, 102);
    const result = simulateBacktest(candles, [signal()], config);
    expect(result.trades[0]).toMatchObject({ entry: 100, target: 102, result: "WIN", grossR: 2 });
    expect(result.metrics).toMatchObject({ trades: 1, wins: 1, winRate: 100, expectancyR: 2 });
  });
  it("resolves an ambiguous stop-and-target candle conservatively as a loss", () => {
    const candles = [...base]; candles[11] = candle(11, 100, 102.2, 98.8, 100);
    expect(simulateBacktest(candles, [signal()], config).trades[0].result).toBe("LOSS");
  });
  it("supports bearish trades and subtracts trading costs", () => {
    const candles = [...base]; candles[11] = candle(11, 100, 100.2, 97.8, 98);
    const result = simulateBacktest(candles, [signal({ direction: "bearish", pattern: "Bearish Engulfing" })], { ...config, feesBps: 10, slippageBps: 5 });
    expect(result.trades[0].result).toBe("WIN");
    expect(result.trades[0].netR).toBeLessThan(result.trades[0].grossR);
  });
  it("reports drawdown and pattern/session breakdowns", () => {
    const candles = [...base]; candles[11] = candle(11, 100, 100.3, 98.8, 99);
    const result = simulateBacktest(candles, [signal()], config);
    expect(result.metrics.maximumDrawdownR).toBe(1);
    expect(result.byPattern[0]).toMatchObject({ name: "Bullish Engulfing", trades: 1 });
    expect(result.bySession[0]).toMatchObject({ name: "London", trades: 1 });
    expect(result.warning).toContain("Small sample");
  });
});
