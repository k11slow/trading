import { NextResponse } from "next/server";
import { getSymbolNewsContext } from "@/lib/news";
import { apiError, categorySchema, symbolSchema } from "../news/_validation";
export async function GET(request: Request) {
  try { const params = new URL(request.url).searchParams; const symbol = symbolSchema.parse(params.get("symbol")); const category = categorySchema.parse(params.get("category")); const data = await getSymbolNewsContext(symbol, category); return NextResponse.json({ ok: data.source !== "UNAVAILABLE", data, source: data.source, provider: data.provider, message: data.message }); }
  catch (error) { const failure = apiError(error); return NextResponse.json({ ok: false, data: null, source: "UNAVAILABLE", provider: "Finnhub", message: failure.message }, { status: failure.status }); }
}
