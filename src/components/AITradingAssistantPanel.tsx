"use client";
import { type FormEvent, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import {
  buildTradingCoach,
  type DirectionalScore,
  type ExplanationMode,
  type RuleBasedSetup,
  type TradingAssistantResult,
} from "@/lib/ai";
import type { PatternSensitivity } from "@/lib/analysis";
import { formatPrice, type MarketAsset } from "@/lib/market-data";
import type { Candle } from "@/lib/market-data/types";
import { askTradingAssistant } from "@/hooks/use-ai-assistant";
const modes: ExplanationMode[] = ["beginner", "standard", "advanced"];
export function AITradingAssistantPanel({
  asset,
  facts,
  result,
  loading,
  error,
  mode,
  onModeChange,
  onRefresh,
  patternSensitivity,
  onPatternSensitivityChange,
  recentCandles,
  debug,
}: {
  asset: MarketAsset;
  facts: RuleBasedSetup | null;
  result: TradingAssistantResult | null;
  loading: boolean;
  error: string | null;
  mode: ExplanationMode;
  onModeChange: (mode: ExplanationMode) => void;
  onRefresh: () => void;
  patternSensitivity: PatternSensitivity;
  onPatternSensitivityChange: (value: PatternSensitivity) => void;
  recentCandles?: Candle[];
  debug?: {
    source: string;
    provider: string;
    timeframe: string;
    lastCandleTimestamp?: number | null;
  };
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  if (!facts)
    return (
      <aside className="hidden w-[380px] shrink-0 border-l border-[#20242d] bg-[#0c0f14] xl:block">
        <div className="p-4">
          <div className="flex items-center gap-2 text-[9px] font-bold tracking-widest text-[#8993a1]">
            <Bot size={13} className="text-blue-400" />
            AI COACH
          </div>
          <div className="mt-5 space-y-2">
            {[80, 100, 72, 92].map((width) => (
              <div
                key={width}
                className="h-3 animate-pulse bg-[#171c24]"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
          <div className="mt-4 text-[8px] leading-4 text-[#596170]">
            The chart is ready first. Multi-timeframe coaching is loading
            separately.
          </div>
        </div>
      </aside>
    );
  const coach = buildTradingCoach(facts, mode, recentCandles);
  const support = facts.setup1H.support;
  const resistance = facts.setup1H.resistance;
  const viewTone =
    facts.preference === "BUY"
      ? "text-[#16c784]"
      : facts.preference === "SELL"
        ? "text-[#ea3943]"
        : "text-amber-400";
  const submit = async (event?: FormEvent, suggested?: string) => {
    event?.preventDefault();
    const text = (suggested ?? question).trim();
    if (!text || chatLoading) return;
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text }]);
    setChatLoading(true);
    try {
      if (/last\s+(?:5|five)?\s*candles?/i.test(text)) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: `${coach.candleStory.join(" ")} Overall: ${coach.candleOverall}`,
          },
        ]);
        return;
      }
      const reply = await askTradingAssistant(text, facts, mode);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: reply.answer },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "I could not answer from the current setup facts right now.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };
  return (
    <aside className="hidden w-[380px] shrink-0 overflow-y-auto border-l border-[#20242d] bg-[#0c0f14] xl:block thin-scrollbar">
      <header className="flex h-10 items-center border-b border-[#20242d] px-4">
        <Bot size={13} className="mr-2 text-blue-400" />
        <b className="text-[9px] tracking-[.14em]">AI TRADING COACH</b>
        <span className="ml-auto text-[8px] text-[#596170]">
          {asset.symbol}
        </span>
      </header>
      <div className="p-4">
        <section>
          <div className="text-[8px] font-bold tracking-[.18em] text-[#687180]">
            INTRADAY DECISION
          </div>
          <div className={`mt-1 text-xl font-black ${viewTone}`}>
            {coach.view}
          </div>
          <div className="mt-1 text-[9px] text-[#8993a1]">
            Setup strength: <b className="text-white">{coach.strength}</b>
          </div>
          <p className="mt-3 text-[10px] leading-4 text-[#c3c9d2]">
            {coach.mainReason}
          </p>
        </section>
        <CoachBox title="MARKET RIGHT NOW">
          <p>{coach.marketNow}</p>
        </CoachBox>
        <CoachBox title="WHAT TO DO NOW" tone="blue">
          <p className="font-medium text-blue-200">{coach.action}</p>
        </CoachBox>
        <div className="mt-3 grid grid-cols-2 gap-px bg-[#252b35]">
          <Case
            label="BUY CASE"
            score={facts.buyScore.total}
            color="text-[#16c784]"
          />
          <Case
            label="SELL CASE"
            score={facts.sellScore.total}
            color="text-[#ea3943]"
          />
        </div>
        <CoachBox title="MARKET CONTROL">
          <Control
            label="BUYERS"
            state={coach.buyers}
            score={facts.buyScore.total}
            color="bg-[#16c784]"
          />
          <Control
            label="SELLERS"
            state={coach.sellers}
            score={facts.sellScore.total}
            color="bg-[#ea3943]"
          />
          <p className="mt-2 text-[#7f8997]">{coach.controlExplanation}</p>
        </CoachBox>
        <CoachBox title="4H → 1H → 15M FLOW">
          {coach.flow.map((step, index) => (
            <div
              key={step.timeframe}
              className="relative border-b border-[#20252d] py-2 last:border-0"
            >
              <div className="flex items-center">
                <b className="text-[8px] text-blue-400">{step.timeframe}</b>
                <b className="ml-2 text-[9px] text-white">{step.title}</b>
                {index < 2 && <span className="ml-auto text-[#46505d]">↓</span>}
              </div>
              <p className="mt-1 text-[9px] leading-4 text-[#8993a1]">
                {step.explanation}
              </p>
              {mode !== "beginner" && (
                <div className="mt-1 text-[7px] text-[#596170]">
                  Technical: {step.technical}
                </div>
              )}
            </div>
          ))}
        </CoachBox>
        <CoachBox title="WHAT THE LAST CANDLES SAY">
          {coach.candleStory.map((story) => (
            <p key={story} className="mb-1.5">
              {story}
            </p>
          ))}
          <p className="mt-2 border-t border-[#252b35] pt-2 text-[#b8c0cb]">
            Overall: {coach.candleOverall}
          </p>
        </CoachBox>
        {coach.pattern && (
          <details className="mt-3 border border-[#252b35] bg-[#0a0d12]">
            <summary className="cursor-pointer px-3 py-2 text-[8px] font-bold tracking-widest text-fuchsia-400">
              RECENT PATTERN · {coach.pattern.name}
            </summary>
            <div className="space-y-2 border-t border-[#252b35] p-3 text-[9px] leading-4 text-[#8993a1]">
              <p>
                <b className="text-white">What it means:</b>{" "}
                {coach.pattern.meaning}
              </p>
              <p>
                <b className="text-white">Where:</b> {coach.pattern.location}
              </p>
              <p>
                <b className="text-white">Why it matters:</b>{" "}
                {coach.pattern.importance}
              </p>
              <p>
                <b className="text-white">Status:</b> {coach.pattern.status}
              </p>
            </div>
          </details>
        )}
        <CoachBox title="KEY LEVELS">
          <div className="text-[9px] text-[#8993a1]">
            Current location: <b className="text-white">{coach.location}</b>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px]">
            <div>
              Floor
              <br />
              <b className="text-[#16c784]">
                {support
                  ? `${formatPrice(asset, support.low)}–${formatPrice(asset, support.high)}`
                  : "Unconfirmed"}
              </b>
            </div>
            <div>
              Roof
              <br />
              <b className="text-[#ea3943]">
                {resistance
                  ? `${formatPrice(asset, resistance.low)}–${formatPrice(asset, resistance.high)}`
                  : "Unconfirmed"}
              </b>
            </div>
          </div>
        </CoachBox>
        <CoachBox title="RISK / REWARD">
          <div className="flex items-center">
            <b
              className={
                coach.riskReward.label === "Good"
                  ? "text-[#16c784]"
                  : "text-amber-400"
              }
            >
              {coach.riskReward.label} — {coach.riskReward.value}
            </b>
          </div>
          <p className="mt-1">{coach.riskReward.meaning}</p>
        </CoachBox>
        <div className="mt-3 flex items-center border-t border-[#20242d] py-2 text-[8px]">
          <span className="text-[#687180]">News:</span>
          <b
            className={`ml-2 uppercase ${facts.newsRisk.label === "high" ? "text-red-400" : facts.newsRisk.label === "medium" ? "text-amber-400" : "text-[#8993a1]"}`}
          >
            {facts.newsRisk.label}
          </b>
          {facts.newsRisk.label === "unavailable" && (
            <span className="ml-2 text-[#596170]">
              Technical analysis continues normally.
            </span>
          )}
        </div>
        <CoachBox title={`WHY ${coach.view}`}>
          {coach.signals.map((signal) => (
            <div key={signal.text} className="mb-1.5 flex gap-2">
              <StatusIcon tone={signal.tone} />
              <span>{signal.text}</span>
            </div>
          ))}
        </CoachBox>
        {coach.conflicts.bullish.length > 0 &&
          coach.conflicts.bearish.length > 0 && (
            <CoachBox title="CONFLICTING SIGNALS">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <b className="text-[#16c784]">Bullish</b>
                  {coach.conflicts.bullish.map((item) => (
                    <p key={item}>✓ {item}</p>
                  ))}
                </div>
                <div>
                  <b className="text-[#ea3943]">Bearish</b>
                  {coach.conflicts.bearish.map((item) => (
                    <p key={item}>⚠ {item}</p>
                  ))}
                </div>
              </div>
              <p className="mt-2 border-t border-[#252b35] pt-2">
                {coach.conflicts.conclusion}
              </p>
            </CoachBox>
          )}
        {facts.preference === "WAIT" && (
          <CoachBox title="WHAT I AM WAITING FOR">
            <div className="text-[#16c784]">Option A — BUY trigger</div>
            {facts.buyConditions.map((item, index) => (
              <p key={item}>
                {index + 1}. {plain(item)}
              </p>
            ))}
            <div className="mt-2 text-[#ea3943]">Option B — SELL trigger</div>
            {facts.sellConditions.map((item, index) => (
              <p key={item}>
                {index + 1}. {plain(item)}
              </p>
            ))}
          </CoachBox>
        )}
        <details className="mt-3 border border-[#252b35]">
          <summary className="cursor-pointer px-3 py-2 text-[8px] font-bold tracking-widest text-[#8993a1]">
            ADVANCED DETAILS
          </summary>
          <div className="border-t border-[#252b35] p-3">
            <ScoreDetails title="BUY BREAKDOWN" score={facts.buyScore} />
            <ScoreDetails title="SELL BREAKDOWN" score={facts.sellScore} />
            <div className="mt-2 text-[7px] text-[#596170]">
              Structure: {facts.trend4H.structure.join(" + ")} · confidence{" "}
              {facts.trend4H.confidence}% · news {facts.newsRisk.score}
            </div>
            {process.env.NODE_ENV === "development" && (
              <div className="mt-2 font-mono text-[7px] text-fuchsia-400">
                {debug?.source} • {debug?.provider} • {debug?.timeframe} •{" "}
                {debug?.lastCandleTimestamp ?? "no candle"}
              </div>
            )}
          </div>
        </details>
        <div className="mt-4 flex border border-[#252b35]">
          {modes.map((value) => (
            <button
              key={value}
              onClick={() => onModeChange(value)}
              className={`flex-1 py-1.5 text-[7px] font-bold uppercase ${mode === value ? "bg-blue-500/15 text-blue-400" : "text-[#596170]"}`}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          onClick={() => setChatOpen((value) => !value)}
          className="mt-2 flex w-full items-center border border-[#252b35] px-3 py-2 text-[8px]"
        >
          <Bot size={11} className="mr-2 text-blue-400" />
          ASK THE COACH
          <ChevronDown
            size={10}
            className={`ml-auto ${chatOpen ? "rotate-180" : ""}`}
          />
        </button>
        {chatOpen && (
          <div className="border-x border-b border-[#252b35] p-2">
            <div className="max-h-44 space-y-2 overflow-y-auto">
              {!messages.length &&
                [
                  "Should I buy now?",
                  "Why are you waiting?",
                  "Explain the last candles.",
                  "Where is the floor?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void submit(undefined, prompt)}
                    className="block w-full border border-[#202630] p-1.5 text-left text-[8px] text-[#8993a1]"
                  >
                    {prompt}
                  </button>
                ))}
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`p-2 text-[9px] leading-4 ${message.role === "user" ? "ml-5 bg-blue-500/10" : "mr-3 bg-[#171c24]"}`}
                >
                  {message.text}
                </div>
              ))}
            </div>
            <form onSubmit={submit} className="mt-2 flex">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="h-8 min-w-0 flex-1 border border-[#252b35] bg-[#090c11] px-2 text-[9px] outline-none"
              />
              <button
                disabled={chatLoading}
                className="grid size-8 place-items-center bg-blue-600"
              >
                <Send size={10} />
              </button>
            </form>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-[7px] text-[#596170]">
          <span>
            {result?.source === "openai"
              ? `OpenAI explanation • ${result.model}`
              : "Deterministic coaching fallback"}
          </span>
          <button onClick={onRefresh} disabled={loading}>
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {(error || result?.message) && (
          <div className="mt-1 text-[7px] text-amber-400">
            AI explanation unavailable. The calculated coaching view remains
            active.
          </div>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-[7px] text-[#596170]">
            Coach settings
          </summary>
          <div className="mt-2 flex gap-1">
            {(["low", "medium", "high"] as PatternSensitivity[]).map(
              (value) => (
                <button
                  key={value}
                  onClick={() => onPatternSensitivityChange(value)}
                  className={`border px-2 py-1 text-[7px] ${patternSensitivity === value ? "border-fuchsia-500/30 text-fuchsia-400" : "border-[#252b35]"}`}
                >
                  {value}
                </button>
              ),
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}
function CoachBox({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "blue";
}) {
  return (
    <section
      className={`mt-3 border p-3 text-[9px] leading-4 ${tone === "blue" ? "border-blue-500/20 bg-blue-500/[.05]" : "border-[#252b35] bg-[#0a0d12]"}`}
    >
      <div
        className={`mb-2 text-[8px] font-bold tracking-[.13em] ${tone === "blue" ? "text-blue-400" : "text-[#687180]"}`}
      >
        {title}
      </div>
      {children}
    </section>
  );
}
function Case({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  const strength =
    score >= 80
      ? "Strong"
      : score >= 70
        ? "Good"
        : score >= 60
          ? "Moderate"
          : score >= 50
            ? "Developing"
            : "Weak";
  return (
    <div className="bg-[#10141a] p-2.5">
      <div className="text-[8px] text-[#687180]">{label}</div>
      <b className={`mt-1 block text-sm ${color}`}>{strength}</b>
      <span className="text-[7px] text-[#596170]">
        Technical score {score}/100
      </span>
    </div>
  );
}
function Control({
  label,
  state,
  score,
  color,
}: {
  label: string;
  state: string;
  score: number;
  color: string;
}) {
  const bars = Math.max(1, Math.min(10, Math.ceil(score / 10)));
  return (
    <div className="mb-2 grid grid-cols-[50px_1fr_auto] items-center gap-2">
      <b className="text-[7px]">{label}</b>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 ${index < bars ? color : "bg-[#252b35]"}`}
          />
        ))}
      </div>
      <span className="text-[7px] text-[#8993a1]">{state}</span>
    </div>
  );
}
function StatusIcon({
  tone,
}: {
  tone: "good" | "caution" | "bad" | "forming";
}) {
  return tone === "good" ? (
    <Check size={10} className="mt-0.5 shrink-0 text-[#16c784]" />
  ) : tone === "forming" ? (
    <Clock3 size={10} className="mt-0.5 shrink-0 text-amber-400" />
  ) : tone === "bad" ? (
    <X size={10} className="mt-0.5 shrink-0 text-[#ea3943]" />
  ) : (
    <AlertTriangle size={10} className="mt-0.5 shrink-0 text-amber-400" />
  );
}
function ScoreDetails({
  title,
  score,
}: {
  title: string;
  score: DirectionalScore;
}) {
  return (
    <div className="mb-3">
      <b className="text-[7px] text-[#8993a1]">
        {title} · {score.total}
      </b>
      {score.breakdown.map((item) => (
        <div
          key={item.category}
          className="mt-1 flex text-[7px] text-[#596170]"
        >
          <span>
            {item.category}: {item.reason}
          </span>
          <span className="ml-auto">
            {item.pointsAwarded}/{item.maxPoints}
          </span>
        </div>
      ))}
    </div>
  );
}
const plain = (text: string) =>
  text.replace("15M", "15-minute").replace("1:1.2", "1 to 1.2");
