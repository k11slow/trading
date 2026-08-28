import { NextResponse } from "next/server";
import { explainTradingSetup } from "@/lib/ai/trading-assistant";
import { analysisRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  try { const body = analysisRequestSchema.parse(await request.json()); return NextResponse.json({ ok: true, data: await explainTradingSetup(body.facts, body.mode, body.refresh) }); }
  catch (error) { return NextResponse.json({ ok: false, data: null, message: error instanceof Error ? error.message : "Invalid AI analysis request" }, { status: 400 }); }
}
