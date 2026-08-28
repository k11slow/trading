import { NextResponse } from "next/server";
import { getMarketNews } from "@/lib/news";
import { apiError, categorySchema, symbolSchema } from "./_validation";
export async function GET(request: Request) {
  try { const url = new URL(request.url); const category = categorySchema.parse(url.searchParams.get("category")); const rawSymbol = url.searchParams.get("symbol"); const symbol = rawSymbol ? symbolSchema.parse(rawSymbol) : undefined; const result = await getMarketNews(category, symbol); return NextResponse.json({ ok: result.source !== "UNAVAILABLE", ...result }); }
  catch (error) { const failure = apiError(error); return NextResponse.json({ ok: false, data: [], source: "UNAVAILABLE", provider: "Finnhub", message: failure.message }, { status: failure.status }); }
}
