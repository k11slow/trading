import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { fallbackChat, fallbackExplanation } from "./fallback";
import { analysisInput, analysisInstructions, chatInput, chatInstructions } from "./prompts";
import { assistantExplanationSchema, chatAnswerSchema, validateChatAgainstFacts, validateExplanationAgainstFacts } from "./validation";
import type { ExplanationMode, RuleBasedSetup, TradingAssistantResult } from "./types";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-mini"; const cache = new Map<string, { expiresAt: number; result: TradingAssistantResult }>(); const CACHE_TTL = 15 * 60_000;
const client = () => process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 18_000, maxRetries: 0 }) : null;

export async function explainTradingSetup(facts: RuleBasedSetup, mode: ExplanationMode, refresh = false): Promise<TradingAssistantResult> {
  const key = `${facts.stateKey}:${mode}:${MODEL}`; const cached = cache.get(key); if (!refresh && cached && cached.expiresAt > Date.now()) return { ...cached.result, cached: true };
  const openai = client(); const fallback = (message: string): TradingAssistantResult => ({ analysis: fallbackExplanation(facts, mode), source: "rule-based", model: null, generatedAt: Date.now(), cached: false, message });
  if (!openai) return fallback("OpenAI explanation unavailable: OPENAI_API_KEY is not configured");
  let lastError = "OpenAI explanation unavailable";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await openai.responses.parse({ model: MODEL, store: false, instructions: `${analysisInstructions(mode)}${attempt ? " Previous output failed validation. Follow every fact exactly." : ""}`, input: analysisInput(facts), text: { format: zodTextFormat(assistantExplanationSchema, "trading_setup_explanation") } });
      if (!response.output_parsed) throw new Error("OpenAI returned no structured output"); const analysis = validateExplanationAgainstFacts(response.output_parsed, facts); const result: TradingAssistantResult = { analysis, source: "openai", model: MODEL, generatedAt: Date.now(), cached: false }; cache.set(key, { expiresAt: Date.now() + CACHE_TTL, result }); return result;
    } catch (error) { lastError = error instanceof Error ? error.message : "OpenAI request failed"; }
  }
  return fallback(`AI explanation unavailable; using rule engine. ${lastError}`);
}

export async function answerTradingQuestion(question: string, facts: RuleBasedSetup, mode: ExplanationMode) {
  const openai = client(); if (!openai) return { answer: fallbackChat(question, facts), source: "rule-based" as const, model: null, message: "OpenAI chat unavailable" };
  try { const response = await openai.responses.parse({ model: MODEL, store: false, instructions: chatInstructions(mode), input: chatInput(question, facts), text: { format: zodTextFormat(chatAnswerSchema, "trading_assistant_chat") } }); if (!response.output_parsed) throw new Error("No chat output"); return { answer: validateChatAgainstFacts(response.output_parsed.answer, facts), source: "openai" as const, model: MODEL }; }
  catch { return { answer: fallbackChat(question, facts), source: "rule-based" as const, model: null, message: "AI chat unavailable; rule-based answer shown" }; }
}
