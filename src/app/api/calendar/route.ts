import { NextResponse } from "next/server";
import { getEconomicCalendar } from "@/lib/news";
import { apiError, impactSchema } from "../news/_validation";
import { z } from "zod";
const currency = z.string().length(3).regex(/^[A-Z]+$/); const timestamp = z.coerce.number().int().positive();
export async function GET(request: Request) {
  try { const params = new URL(request.url).searchParams; const impacts = params.getAll("impact").map((value) => impactSchema.parse(value)); const currencies = params.getAll("currency").map((value) => currency.parse(value.toUpperCase())); const from = params.get("from") ? timestamp.parse(params.get("from")) : undefined; const to = params.get("to") ? timestamp.parse(params.get("to")) : undefined; const result = await getEconomicCalendar({ impacts, currencies, from, to }); return NextResponse.json({ ok: result.source !== "UNAVAILABLE", ...result }); }
  catch (error) { const failure = apiError(error); return NextResponse.json({ ok: false, data: [], source: "UNAVAILABLE", provider: "Finnhub", message: failure.message }, { status: failure.status }); }
}
