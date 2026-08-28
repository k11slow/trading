import { NextRequest, NextResponse } from "next/server";
import { marketError } from "../_shared";
import { parseCategory, parseTimeframe, providerFor, resolveSymbol } from "@/lib/market-data/service";
import { validateCandles } from "@/lib/market-data/validation";

export async function GET(request: NextRequest) {
  try { const category = parseCategory(request.nextUrl.searchParams.get("category")); const timeframe = parseTimeframe(request.nextUrl.searchParams.get("timeframe")); const symbol = { ...resolveSymbol(request.nextUrl.searchParams.get("symbol"), category), chainId: request.nextUrl.searchParams.get("chainId") ?? undefined, pairAddress: request.nextUrl.searchParams.get("pairAddress") ?? undefined }; const result = await providerFor(category, symbol).getCandles(symbol, timeframe); const validated = validateCandles(result.data, symbol); if (!validated.candles.length) return NextResponse.json({ ok: false, data: null, source: "UNAVAILABLE", provider: result.provider, message: "Provider returned no valid candles" }, { status: 502 }); return NextResponse.json({ ok: true, ...result, data: validated.candles, rejectedCount: validated.rejected.length }); }
  catch (error) { return marketError(error); }
}
