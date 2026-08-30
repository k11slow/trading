import { NextResponse } from "next/server";
import { z } from "zod";
import { runPatternBacktest } from "@/lib/backtesting";
import { providerFor, resolveSymbol } from "@/lib/market-data/service";
import { validateCandles } from "@/lib/market-data/validation";
import { marketError } from "../market/_shared";

const schema = z.object({
  symbol: z.string().trim().min(1).max(64),
  category: z.enum(["Forex", "Stocks", "Futures", "Crypto", "Meme Coins"]),
  timeframe: z.enum(["15m", "1H", "4H"]),
  minimumConfidence: z.number().int().min(40).max(95).default(60),
  stopAtr: z.number().min(.25).max(5).default(1),
  targetAtr: z.number().min(.5).max(10).default(2),
  maximumHoldCandles: z.number().int().min(1).max(40).default(12),
  feesBps: z.number().min(0).max(100).default(5),
  slippageBps: z.number().min(0).max(100).default(3),
});

export async function POST(request: Request) {
  try {
    const config = schema.parse(await request.json()); const asset = resolveSymbol(config.symbol, config.category); const response = await providerFor(config.category, asset).getCandles(asset, config.timeframe); const validated = validateCandles(response.data, asset);
    if (validated.candles.length < 60) return NextResponse.json({ ok: false, data: null, message: "At least 60 valid candles are required for a backtest" }, { status: 422 });
    const data = runPatternBacktest(validated.candles, config);
    return NextResponse.json({ ok: true, data, source: response.source, provider: response.provider, rejectedCandles: validated.rejected.length });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, data: null, message: error.issues[0]?.message ?? "Invalid backtest settings" }, { status: 400 });
    return marketError(error);
  }
}
