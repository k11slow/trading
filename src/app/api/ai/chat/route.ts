import { NextResponse } from "next/server";
import { answerTradingQuestion } from "@/lib/ai/trading-assistant";
import { chatRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  try { const body = chatRequestSchema.parse(await request.json()); return NextResponse.json({ ok: true, data: await answerTradingQuestion(body.question, body.facts, body.mode) }); }
  catch (error) { return NextResponse.json({ ok: false, data: null, message: error instanceof Error ? error.message : "Invalid AI chat request" }, { status: 400 }); }
}
