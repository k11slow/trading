import { NextResponse } from "next/server";
import { z } from "zod";
import { providerFor, resolveSymbol } from "@/lib/market-data/service";
import type { MarketSymbol, Quote } from "@/lib/market-data/types";
const item = z.object({
  symbol: z.string().min(1).max(64),
  category: z.enum(["Forex", "Stocks", "Futures", "Crypto", "Meme Coins"]),
  chainId: z.string().max(40).optional(),
  pairAddress: z.string().max(128).optional(),
});
const schema = z.object({ instruments: z.array(item).min(1).max(30) });

async function limited<T, R>(
  items: T[],
  concurrency: number,
  work: (item: T) => Promise<R>,
) {
  const output: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) output.push(await work(items[index++]));
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return output;
}

export async function POST(request: Request) {
  try {
    const parsed = schema.parse(await request.json());
    const assets = parsed.instruments.map((entry) => ({
      ...resolveSymbol(entry.symbol, entry.category),
      chainId: entry.chainId,
      pairAddress: entry.pairAddress,
    }));
    const groups = new Map<string, MarketSymbol[]>();
    assets.forEach((asset) => {
      const key = `${asset.category}:${asset.chainId && asset.pairAddress ? "dex" : "default"}`;
      groups.set(key, [...(groups.get(key) ?? []), asset]);
    });
    const results: { quote: Quote; source: string; provider: string }[] = [];
    await Promise.all(
      [...groups.values()].map(async (symbols) => {
        const provider = providerFor(symbols[0].category, symbols[0]);
        if (provider.getQuotes && symbols.length > 1) {
          try {
            const batch = await provider.getQuotes(symbols);
            batch.data.forEach((quote) =>
              results.push({
                quote,
                source: batch.source,
                provider: batch.provider,
              }),
            );
            return;
          } catch {
            /* A bad symbol must not poison the rest of the watchlist. */
          }
        }
        const rows = await limited(symbols, 3, async (symbol) => {
          try {
            return await providerFor(symbol.category, symbol).getQuote(symbol);
          } catch {
            return null;
          }
        });
        rows.forEach((row) => {
          if (row)
            results.push({
              quote: row.data,
              source: row.source,
              provider: row.provider,
            });
        });
      }),
    );
    return NextResponse.json({ ok: true, data: results });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        data: [],
        message:
          error instanceof Error ? error.message : "Batch quotes unavailable",
      },
      { status: 400 },
    );
  }
}
