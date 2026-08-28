import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { analyzeMultipleTimeframes, analyzeMultiTimeframePatterns } from "@/lib/analysis";
import { allAssets } from "@/lib/market-data";
import { providerFor } from "@/lib/market-data/service";
import type { MarketSymbol, Timeframe } from "@/lib/market-data/types";
import { calculateSetup } from "./setup-engine";
import type { RuleBasedSetup } from "./types";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
const timeframes: Timeframe[] = ["15m", "1H", "4H"];
const aiPreferenceSchema = z.object({
  preferredSymbol: z.string().nullable(),
  rationale: z.string().min(1).max(240),
});

export type MarketScanCandidate = Pick<RuleBasedSetup, "symbol" | "preference" | "setupScore" | "setupQuality" | "confirmation15M" | "riskReward" | "ruleReasons" | "ruleWarnings"> & {
  category: MarketSymbol["category"];
  name: string;
  price: number;
};
export type MarketScanResult = {
  candidates: MarketScanCandidate[];
  preferredSymbol: string | null;
  rationale: string;
  source: "openai" | "rule-based";
  model: string | null;
  scanned: number;
  unavailable: number;
  generatedAt: number;
};

async function analyzeAsset(asset: MarketSymbol): Promise<MarketScanCandidate> {
  const provider = providerFor(asset.category, asset);
  const [quoteResult, ...candleResults] = await Promise.all([
    provider.getQuote(asset),
    ...timeframes.map((timeframe) => provider.getCandles(asset, timeframe)),
  ]);
  const datasets = Object.fromEntries(timeframes.map((timeframe, index) => [timeframe, candleResults[index].data]));
  const structure = analyzeMultipleTimeframes(asset.symbol, datasets);
  const patterns = analyzeMultiTimeframePatterns(asset.symbol, datasets, structure, { sensitivity: "medium" });
  const facts = calculateSetup({ asset, quote: quoteResult.data, structure, patterns });
  return {
    symbol: facts.symbol,
    category: asset.category,
    name: asset.name,
    price: facts.price,
    preference: facts.preference,
    setupScore: facts.setupScore,
    setupQuality: facts.setupQuality,
    confirmation15M: facts.confirmation15M,
    riskReward: facts.riskReward,
    ruleReasons: facts.ruleReasons,
    ruleWarnings: facts.ruleWarnings,
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { status: "fulfilled", value: await task(items[index]) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  }));
  return results;
}

let cache: { expiresAt: number; result: MarketScanResult } | null = null;
export async function scanAllMarkets(refresh = false): Promise<MarketScanResult> {
  if (!refresh && cache && cache.expiresAt > Date.now()) return cache.result;
  const assets = allAssets.filter((asset) => asset.dataStatus !== "UNAVAILABLE");
  const settled = await mapWithConcurrency(assets, 5, analyzeAsset);
  const candidates = settled
    .flatMap((result) => result.status === "fulfilled" ? [result.value] : [])
    .sort((a, b) => Number(b.preference === "BUY") - Number(a.preference === "BUY") || b.setupScore - a.setupScore);
  const qualified = candidates.filter((candidate) => candidate.preference === "BUY");
  const fallback = qualified[0] ?? null;
  let preferredSymbol = fallback?.symbol ?? null;
  let rationale = fallback
    ? `${fallback.symbol} is the highest-scoring market that passed the intraday BUY gates.`
    : "No scanned market currently passes every intraday BUY gate.";
  let source: MarketScanResult["source"] = "rule-based";
  let model: string | null = null;
  if (process.env.OPENAI_API_KEY && qualified.length) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 18_000, maxRetries: 0 });
      const response = await openai.responses.parse({
        model: MODEL,
        store: false,
        instructions: "Rank only the supplied qualified intraday BUY setups. Prefer confirmation quality, setup score, risk/reward, and lower warning count. Select exactly one supplied symbol. Do not invent data or promise profit.",
        input: JSON.stringify(qualified.slice(0, 10)),
        text: { format: zodTextFormat(aiPreferenceSchema, "market_scan_preference") },
      });
      const choice = response.output_parsed;
      if (choice?.preferredSymbol && qualified.some((candidate) => candidate.symbol === choice.preferredSymbol)) {
        preferredSymbol = choice.preferredSymbol;
        rationale = choice.rationale;
        source = "openai";
        model = MODEL;
      }
    } catch { /* Deterministic ranking remains available. */ }
  }
  const result: MarketScanResult = { candidates, preferredSymbol, rationale, source, model, scanned: candidates.length, unavailable: settled.length - candidates.length, generatedAt: Date.now() };
  cache = { expiresAt: Date.now() + 60_000, result };
  return result;
}
