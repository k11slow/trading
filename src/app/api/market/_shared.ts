import { NextResponse } from "next/server";
import { MarketDataError } from "@/lib/market-data/types";

export function marketError(error: unknown) {
  const known = error instanceof MarketDataError;
  return NextResponse.json({ ok: false, data: null, source: "UNAVAILABLE", provider: "Unavailable", message: known ? error.message : "Market data request failed", code: known ? error.code : "UNKNOWN_ERROR" }, { status: known ? error.status : 500 });
}
