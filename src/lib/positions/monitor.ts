import { randomUUID } from "node:crypto";
import { findAsset } from "@/lib/market-data";
import { providerFor } from "@/lib/market-data/service";
import type { MarketCategory } from "@/lib/market-data/types";
import { scanAllMarkets } from "@/lib/ai/market-scanner";
import { sendTelegramMessage } from "@/lib/telegram";

export type PaperPosition = {
  id: string;
  symbol: string;
  category: MarketCategory;
  side: "BUY";
  entry: number;
  stop: number;
  target: number;
  units: number;
  openedAt: number;
  status: "OPEN" | "EXIT_ALERTED" | "CLOSED";
  lastPrice: number;
  lastCheckedAt: number;
  exitReason: string | null;
  exitAlertedAt: number | null;
};

type PositionInput = Pick<PaperPosition, "symbol" | "category" | "entry" | "stop" | "target" | "units">;
type ExitEvaluation = {
  price: number;
  openedAt: number;
  stop: number;
  target: number;
  now?: number;
  currentSetup?: {
    confirmation15M: {
      direction: "bullish" | "bearish" | "neutral" | "none";
      confirmed: boolean;
    };
  } | null;
};
export const SETUP_INVALIDATION_GRACE_MS = 15 * 60_000;
export class PositionConflictError extends Error {}
const globalState = globalThis as typeof globalThis & {
  __paperPositions?: Map<string, PaperPosition>;
  __paperMonitor?: ReturnType<typeof setInterval>;
  __buyAlertMonitor?: ReturnType<typeof setInterval>;
  __buyAlerts?: Map<string, { signature: string; sentAt: number }>;
  __paperMonitorRunning?: boolean;
  __buyAlertMonitorRunning?: boolean;
};
const positions = globalState.__paperPositions ??= new Map<string, PaperPosition>();
const buyAlerts = globalState.__buyAlerts ??= new Map<string, { signature: string; sentAt: number }>();
const formatPrice = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: value >= 1_000 ? 2 : value >= 1 ? 4 : value >= .01 ? 6 : 8, maximumFractionDigits: value >= 1_000 ? 2 : value >= 1 ? 4 : value >= .01 ? 6 : 8 });
const percentFrom = (entry: number, value: number) => `${value >= entry ? "+" : ""}${((value - entry) / entry * 100).toFixed(2)}%`;
const formatUnits = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 8 });

export function evaluatePositionExit({ price, openedAt, stop, target, now = Date.now(), currentSetup }: ExitEvaluation) {
  if (price <= stop) return `Stop Loss reached at ${price}`;
  if (price >= target) return `Take Profit reached at ${price}`;
  if (now - openedAt < SETUP_INVALIDATION_GRACE_MS) return null;
  if (currentSetup?.confirmation15M.confirmed && currentSetup.confirmation15M.direction === "bearish") {
    return "A confirmed opposing 15-minute signal invalidated the BUY setup";
  }
  return null;
}

async function checkPosition(position: PaperPosition) {
  if (position.status !== "OPEN") return;
  const asset = { ...findAsset(position.symbol), category: position.category };
  const quote = await providerFor(position.category, asset).getQuote(asset);
  const price = quote.data.price;
  position.lastPrice = price;
  position.lastCheckedAt = Date.now();
  let reason = evaluatePositionExit({ ...position, price });
  if (!reason && Date.now() - position.openedAt >= SETUP_INVALIDATION_GRACE_MS) {
    const scan = await scanAllMarkets();
    const current = scan.candidates.find((candidate) => candidate.symbol === position.symbol && candidate.category === position.category);
    reason = evaluatePositionExit({ ...position, price, currentSetup: current });
  }
  if (!reason) return;
  position.status = "EXIT_ALERTED";
  position.exitReason = reason;
  position.exitAlertedAt = Date.now();
  try {
    await sendTelegramMessage(`🚨 <b>EXIT PAPER TRADE</b>

<b>${position.symbol}</b>  •  SELL / CLOSE

<b>WHY</b>
${reason}

<b>PRICE TICKET</b>
Current       <code>${formatPrice(price)}</code>
Entry         <code>${formatPrice(position.entry)}</code>
Stop          <code>${formatPrice(position.stop)}</code>  ${percentFrom(position.entry, position.stop)}
Target        <code>${formatPrice(position.target)}</code>  ${percentFrom(position.entry, position.target)}
Units         <code>${formatUnits(position.units)}</code>

⚠️ Verify the live quote before closing.`);
  } catch { /* The alert remains visible in the app when Telegram is unavailable. */ }
}

async function monitor() {
  if (globalState.__paperMonitorRunning) return;
  globalState.__paperMonitorRunning = true;
  try {
    for (const position of positions.values()) {
      try { await checkPosition(position); } catch { /* Retry on the next monitor cycle. */ }
    }
  } finally {
    globalState.__paperMonitorRunning = false;
  }
}
async function monitorBuyOpportunity() {
  if (globalState.__buyAlertMonitorRunning) return;
  globalState.__buyAlertMonitorRunning = true;
  try {
    const scan = await scanAllMarkets();
    const candidate = scan.candidates.find((item) => item.symbol === scan.preferredSymbol && item.preference === "BUY");
    if (!candidate || [...positions.values()].some((position) => position.symbol === candidate.symbol && position.category === candidate.category && position.status !== "CLOSED")) return;
    const signature = `${candidate.setupScore}:${candidate.riskReward.entry}:${candidate.riskReward.stop}:${candidate.riskReward.target}`;
    const previous = buyAlerts.get(candidate.symbol);
    if (previous?.signature === signature || previous && Date.now() - previous.sentAt < 15 * 60_000) return;
    const tradingViewSymbol = candidate.category === "Crypto" || candidate.category === "Meme Coins" ? `BINANCE:${candidate.symbol.replace("/", "")}` : candidate.category === "Forex" ? `FX:${candidate.symbol.replace("/", "")}` : candidate.symbol;
    try {
      await sendTelegramMessage(`🟢 <b>${candidate.setupScore >= 80 ? "STRONG BUY" : "BUY"}</b>

<b>${candidate.symbol}</b>  •  LONG
<code>${tradingViewSymbol}</code>

<b>ORDER TICKET</b>
Order         <b>LIMIT BUY</b>
Entry         <code>${formatPrice(candidate.riskReward.entry)}</code>
Stop loss     <code>${formatPrice(candidate.riskReward.stop!)}</code>  ${percentFrom(candidate.riskReward.entry, candidate.riskReward.stop!)}
Take profit   <code>${formatPrice(candidate.riskReward.target!)}</code>  ${percentFrom(candidate.riskReward.entry, candidate.riskReward.target!)}

R:R           <b>1:${candidate.riskReward.ratio?.toFixed(2) ?? "—"}</b>
AI score      <b>${candidate.setupScore}/100</b>

⚠️ Check the live Ask first.
After your paper order fills, press <b>I BOUGHT THIS</b> on the website to activate exit alerts.`);
      buyAlerts.set(candidate.symbol, { signature, sentAt: Date.now() });
    } catch { /* Retry after Telegram becomes available. */ }
  } catch {
    /* Retry the market scan on the next alert cycle. */
  } finally {
    globalState.__buyAlertMonitorRunning = false;
  }
}
if (process.env.NODE_ENV === "development") {
  if (globalState.__paperMonitor) clearInterval(globalState.__paperMonitor);
  if (globalState.__buyAlertMonitor) clearInterval(globalState.__buyAlertMonitor);
  globalState.__paperMonitor = undefined;
  globalState.__buyAlertMonitor = undefined;
}
if (!globalState.__paperMonitor) {
  globalState.__paperMonitor = setInterval(() => void monitor(), 30_000);
  globalState.__paperMonitor.unref?.();
}
if (!globalState.__buyAlertMonitor) {
  globalState.__buyAlertMonitor = setInterval(() => void monitorBuyOpportunity(), 60_000);
  globalState.__buyAlertMonitor.unref?.();
}

export async function openPaperPosition(input: PositionInput) {
  const duplicate = [...positions.values()].find((position) => position.symbol === input.symbol && position.category === input.category && position.status !== "CLOSED");
  if (duplicate) throw new PositionConflictError(`${input.symbol} already has an active paper tracker`);
  const position: PaperPosition = { id: randomUUID(), ...input, side: "BUY", openedAt: Date.now(), status: "OPEN", lastPrice: input.entry, lastCheckedAt: Date.now(), exitReason: null, exitAlertedAt: null };
  positions.set(position.id, position);
  try { await sendTelegramMessage(`✅ <b>EXIT TRACKING ACTIVE</b>

<b>${position.symbol}</b>  •  LONG

<b>POSITION</b>
Entry         <code>${formatPrice(position.entry)}</code>
Stop loss     <code>${formatPrice(position.stop)}</code>  ${percentFrom(position.entry, position.stop)}
Take profit   <code>${formatPrice(position.target)}</code>  ${percentFrom(position.entry, position.target)}
Units         <code>${formatUnits(position.units)}</code>

🔔 You will get one exit alert if the stop, target, or setup invalidation triggers.`); } catch { /* Tracking works without Telegram. */ }
  return position;
}
export function listPaperPositions() { return [...positions.values()].sort((a, b) => b.openedAt - a.openedAt); }
export function closePaperPosition(id: string) { const position = positions.get(id); if (!position) return null; position.status = "CLOSED"; return position; }
