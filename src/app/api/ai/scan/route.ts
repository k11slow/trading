import { NextRequest, NextResponse } from "next/server";
import { scanAllMarkets } from "@/lib/ai/market-scanner";

export async function GET(request: NextRequest) {
  try {
    const data = await scanAllMarkets(request.nextUrl.searchParams.get("refresh") === "1");
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, data: null, message: error instanceof Error ? error.message : "Market scan failed" }, { status: 500 });
  }
}
