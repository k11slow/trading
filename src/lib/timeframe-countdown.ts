import type { Timeframe } from "@/lib/market-data/types";

const timeframeSeconds: Record<Timeframe, number> = {
  "15m": 15 * 60,
  "1H": 60 * 60,
  "4H": 4 * 60 * 60,
  "1D": 24 * 60 * 60,
};

export function secondsUntilCandleClose(
  timeframe: Timeframe,
  nowMs: number,
) {
  const interval = timeframeSeconds[timeframe];
  const elapsed = Math.floor(nowMs / 1000) % interval;
  return elapsed === 0 ? interval : interval - elapsed;
}

export function formatCandleCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
