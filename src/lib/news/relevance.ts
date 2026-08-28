import type { MarketSymbol } from "@/lib/market-data/types";
import type { EconomicEvent, NewsArticle } from "./types";

const macroCurrencies: Record<string, string[]> = {
  "EUR/USD": ["EUR", "USD"], "GBP/USD": ["GBP", "USD"], "USD/JPY": ["USD", "JPY"],
  GOLD: ["USD"], SILVER: ["USD"], USOIL: ["USD"], NASDAQ: ["USD"],
  "BTC/USDT": ["USD"], "ETH/USDT": ["USD"], "SOL/USDT": ["USD"],
  "DOGE/USDT": ["USD"], "PEPE/USDT": ["USD"], "TRUMP/USDT": ["USD"], "SHIB/USDT": ["USD"],
};
const assetKeywords: Record<string, string[]> = {
  GOLD: ["gold", "fed", "federal reserve", "inflation", "cpi", "jobs", "payroll", "war", "sanction", "iran", "middle east", "geopolitical"],
  SILVER: ["silver", "fed", "inflation", "industrial metals"],
  USOIL: ["oil", "crude", "opec", "supply", "iran", "middle east", "sanction"],
  NASDAQ: ["nasdaq", "technology", "fed", "rates", "inflation"],
  "BTC/USDT": ["bitcoin", "btc", "crypto", "fed", "liquidity", "etf", "regulation", "exchange", "hack"],
  "ETH/USDT": ["ethereum", "eth", "crypto", "etf", "regulation", "exchange", "hack"],
  "SOL/USDT": ["solana", "sol", "crypto", "regulation", "exchange", "hack"],
  "TRUMP/USDT": ["trump", "tariff", "trade negotiation", "china", "eu", "sanction", "crypto", "token", "government action"],
};
const eventKeywords = ["rate decision", "interest rate", "federal reserve", "fed", "powell", "ecb", "lagarde", "bank of england", "boe", "bank of japan", "boj", "cpi", "inflation", "ppi", "payroll", "nfp", "unemployment", "gdp", "retail sales", "pmi", "ism", "jobless"];

export function symbolCurrencies(asset: MarketSymbol) { return macroCurrencies[asset.symbol] ?? (asset.category === "Forex" ? asset.symbol.split("/") : []); }
export function eventRelevance(asset: MarketSymbol, event: EconomicEvent) {
  const title = event.title.toLowerCase(); const currencies = symbolCurrencies(asset);
  if (currencies.includes(event.currency.toUpperCase())) return { score: 1, reason: `${event.currency.toUpperCase()} directly affects ${asset.symbol}` };
  const keywords = assetKeywords[asset.symbol] ?? [asset.symbol.toLowerCase(), asset.name.toLowerCase()];
  if (keywords.some((keyword) => title.includes(keyword))) return { score: .85, reason: `Event topic is relevant to ${asset.symbol}` };
  return { score: 0, reason: "No direct currency or asset connection" };
}
export function articleRelevance(asset: MarketSymbol, article: NewsArticle) {
  const text = `${article.headline} ${article.category}`.toLowerCase(); const normalized = asset.symbol.replace("/USDT", "").toLowerCase();
  if (article.relatedSymbols.some((symbol) => symbol.toUpperCase() === asset.symbol || symbol.toLowerCase() === normalized) || text.includes(normalized)) return { score: 1, reason: `Headline directly references ${asset.symbol}` };
  if (article.relatedCurrencies.some((currency) => symbolCurrencies(asset).includes(currency.toUpperCase()))) return { score: .8, reason: `Headline affects a currency linked to ${asset.symbol}` };
  const keywords = assetKeywords[asset.symbol] ?? [asset.name.toLowerCase(), normalized, ...(asset.category === "Stocks" ? ["earnings", "guidance", "fed", "rates"] : [])];
  const matched = keywords.find((keyword) => text.includes(keyword));
  if (matched) return { score: matched === "crypto" && asset.symbol !== "TRUMP/USDT" ? .55 : .85, reason: `Headline matches ${matched} sensitivity` };
  if (eventKeywords.some((keyword) => text.includes(keyword)) && symbolCurrencies(asset).includes("USD")) return { score: .55, reason: "Broad macro relevance" };
  return { score: 0, reason: "No direct market connection" };
}
