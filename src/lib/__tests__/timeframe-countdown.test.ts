import { describe, expect, it } from "vitest";
import {
  formatCandleCountdown,
  secondsUntilCandleClose,
} from "@/lib/timeframe-countdown";

describe("candle countdown", () => {
  it("counts down to the next UTC timeframe boundary", () => {
    const now = Date.parse("2026-08-26T15:32:45.000Z");

    expect(secondsUntilCandleClose("15m", now)).toBe(12 * 60 + 15);
    expect(secondsUntilCandleClose("1H", now)).toBe(27 * 60 + 15);
    expect(secondsUntilCandleClose("4H", now)).toBe(27 * 60 + 15);
    expect(secondsUntilCandleClose("1D", now)).toBe(8 * 3600 + 27 * 60 + 15);
  });

  it("shows a full candle duration at an exact boundary", () => {
    const boundary = Date.parse("2026-08-26T16:00:00.000Z");
    expect(secondsUntilCandleClose("1H", boundary)).toBe(3600);
  });

  it("formats the remaining time as hours, minutes, and seconds", () => {
    expect(formatCandleCountdown(98_765)).toBe("27:26:05");
  });
});
