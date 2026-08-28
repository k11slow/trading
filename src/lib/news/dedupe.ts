import type { NewsArticle } from "./types";

const stop = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "the", "to", "with"]);
export function normalizedHeadline(headline: string) { return headline.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word && !stop.has(word)).join(" "); }
function similarity(left: string, right: string) { const a = new Set(left.split(" ")); const b = new Set(right.split(" ")); const intersection = [...a].filter((word) => b.has(word)).length; const union = new Set([...a, ...b]).size; return union ? intersection / union : 0; }
export function deduplicateNews(articles: NewsArticle[]) {
  return [...articles].sort((a, b) => b.sourceQuality - a.sourceQuality || b.publishedAt - a.publishedAt).filter((article, index, sorted) => {
    const normalized = normalizedHeadline(article.headline);
    return !sorted.slice(0, index).some((existing) => Math.abs(existing.publishedAt - article.publishedAt) <= 6 * 3_600_000 && (normalizedHeadline(existing.headline) === normalized || similarity(normalizedHeadline(existing.headline), normalized) >= .72));
  }).sort((a, b) => b.publishedAt - a.publishedAt);
}
