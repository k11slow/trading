import { describe, expect, it } from "vitest";
import { closePaperPosition, evaluatePositionExit, openPaperPosition, PositionConflictError, SETUP_INVALIDATION_GRACE_MS } from "./monitor";

const position = {
  price: 688.46,
  openedAt: 1_000,
  stop: 686.949,
  target: 700,
};

describe("paper position exit evaluation", () => {
  it("does not exit immediately when the setup temporarily becomes WAIT", () => {
    expect(evaluatePositionExit({
      ...position,
      now: position.openedAt + 1_000,
      currentSetup: { confirmation15M: { direction: "none", confirmed: false } },
    })).toBeNull();
  });

  it("does not treat missing scan data as an exit", () => {
    expect(evaluatePositionExit({
      ...position,
      now: position.openedAt + SETUP_INVALIDATION_GRACE_MS + 1,
      currentSetup: null,
    })).toBeNull();
  });

  it("exits after the grace period for a confirmed opposing 15-minute signal", () => {
    expect(evaluatePositionExit({
      ...position,
      now: position.openedAt + SETUP_INVALIDATION_GRACE_MS,
      currentSetup: { confirmation15M: { direction: "bearish", confirmed: true } },
    })).toBe("A confirmed opposing 15-minute signal invalidated the BUY setup");
  });

  it("keeps stop-loss and take-profit exits immediate", () => {
    expect(evaluatePositionExit({ ...position, price: position.stop, now: position.openedAt + 1_000 })).toContain("Stop Loss");
    expect(evaluatePositionExit({ ...position, price: position.target, now: position.openedAt + 1_000 })).toContain("Take Profit");
  });

  it("prevents duplicate active trackers for the same market", async () => {
    const tracked = await openPaperPosition({ symbol: "BTC/USDT", category: "Crypto", entry: 100, stop: 95, target: 110, units: 1 });
    await expect(openPaperPosition({ symbol: "BTC/USDT", category: "Crypto", entry: 101, stop: 96, target: 111, units: 1 })).rejects.toBeInstanceOf(PositionConflictError);
    closePaperPosition(tracked.id);
  });
});
