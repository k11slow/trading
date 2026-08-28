import { NextRequest, NextResponse } from "next/server";
import { marketError } from "../_shared";
import { parseCategory, providerFor, resolveSymbol } from "@/lib/market-data/service";

export async function GET(request: NextRequest) {
  try { const category = parseCategory(request.nextUrl.searchParams.get("category")); const symbol = { ...resolveSymbol(request.nextUrl.searchParams.get("symbol"), category), chainId: request.nextUrl.searchParams.get("chainId") ?? undefined, pairAddress: request.nextUrl.searchParams.get("pairAddress") ?? undefined }; const result = await providerFor(category, symbol).getQuote(symbol); return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": result.source === "LIVE" ? "public, s-maxage=3, stale-while-revalidate=5" : "public, s-maxage=30" } }); }
  catch (error) { return marketError(error); }
}
