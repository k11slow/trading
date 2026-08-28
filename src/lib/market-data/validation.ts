import type { Candle, DataSourceKind, MarketSymbol } from "./types";

export type CandleRejectionReason = "invalid-timestamp" | "non-finite" | "non-positive" | "invalid-ohlc" | "price-scale-outlier" | "duplicate-timestamp";
export type RejectedCandle = { candle: unknown; reason: CandleRejectionReason; detail: string };
export type CandleValidationResult = { candles: Candle[]; rejected: RejectedCandle[] };
const MIN_TIMESTAMP = 1_230_768_000; // 2009-01-01, before every supported feed

function reject(rejected: RejectedCandle[], candle: unknown, reason: CandleRejectionReason, detail: string) {
  rejected.push({ candle, reason, detail });
  if (process.env.NODE_ENV === "development") console.warn(`[market-data] Rejected candle: ${reason} — ${detail}`, candle);
}

export function validateCandles(input: unknown[], asset?: MarketSymbol, now = Date.now()): CandleValidationResult {
  const rejected: RejectedCandle[] = []; const basic: Candle[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") { reject(rejected, raw, "non-finite", "Candle is not an object"); continue; }
    const value = raw as Partial<Candle>; const numbers = [value.open, value.high, value.low, value.close];
    if (!Number.isInteger(value.time) || value.time! < MIN_TIMESTAMP || value.time! > Math.floor(now / 1000) + 86_400) { reject(rejected, raw, "invalid-timestamp", "Expected a Unix timestamp in seconds within the supported market-data range"); continue; }
    if (!numbers.every((number) => typeof number === "number" && Number.isFinite(number))) { reject(rejected, raw, "non-finite", "OHLC values must be finite numbers"); continue; }
    if (!numbers.every((number) => number! > 0)) { reject(rejected, raw, "non-positive", "OHLC values must be greater than zero"); continue; }
    if (value.high! < Math.max(value.open!, value.close!, value.low!) || value.low! > Math.min(value.open!, value.close!, value.high!)) { reject(rejected, raw, "invalid-ohlc", "High/low do not contain open and close"); continue; }
    basic.push({ time: value.time!, open: value.open!, high: value.high!, low: value.low!, close: value.close!, ...(typeof value.volume === "number" && Number.isFinite(value.volume) && value.volume >= 0 ? { volume: value.volume } : {}) });
  }
  const closes = basic.map((candle) => candle.close).sort((a, b) => a - b); const median = closes[Math.floor(closes.length / 2)] ?? asset?.price ?? 0;
  const unique = new Map<number, Candle>();
  for (const candle of basic) {
    const extremeRatio = median > 0 ? Math.max(candle.high / median, median / candle.low) : 1; const candleRange = (candle.high - candle.low) / candle.close;
    if (extremeRatio > 20 || candleRange > .75) { reject(rejected, candle, "price-scale-outlier", `Candle is incompatible with the series scale (median ${median})`); continue; }
    if (unique.has(candle.time)) reject(rejected, candle, "duplicate-timestamp", "Duplicate timestamp replaced by the latest provider value");
    unique.set(candle.time, candle);
  }
  return { candles: [...unique.values()].sort((a, b) => a.time - b.time), rejected };
}

export function ensureSingleSource<T>(datasets: { source: DataSourceKind; data: T[] }[]) {
  const populated = datasets.filter((dataset) => dataset.data.length); const sources = new Set(populated.map((dataset) => dataset.source));
  if (sources.size > 1) throw new Error("Live and mock market data cannot be merged");
  return populated.flatMap((dataset) => dataset.data);
}
