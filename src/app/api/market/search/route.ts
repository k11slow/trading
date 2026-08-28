import { NextRequest, NextResponse } from "next/server";
import { marketError } from "../_shared";
import { parseCategory, providerFor } from "@/lib/market-data/service";

export async function GET(request: NextRequest) {
  try { const category = parseCategory(request.nextUrl.searchParams.get("category")); const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 40); const result = await providerFor(category).searchSymbols(query, category); return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "public, s-maxage=300" } }); }
  catch (error) { return marketError(error); }
}
