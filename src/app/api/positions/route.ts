import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { closePaperPosition, listPaperPositions, openPaperPosition } from "@/lib/positions/monitor";
const input = z.object({
  symbol: z.string().min(1).max(32),
  category: z.enum(["Forex", "Stocks", "Futures", "Crypto", "Meme Coins"]),
  entry: z.number().positive(),
  stop: z.number().positive(),
  target: z.number().positive(),
  units: z.number().positive().max(1e15),
}).superRefine((position, context) => {
  const fractional = position.category === "Crypto" || position.category === "Meme Coins";
  if (!fractional && !Number.isInteger(position.units)) context.addIssue({ code: "custom", path: ["units"], message: "This market requires whole units" });
  if (position.stop >= position.entry) context.addIssue({ code: "custom", path: ["stop"], message: "A LONG stop loss must be below the entry" });
  if (position.target <= position.entry) context.addIssue({ code: "custom", path: ["target"], message: "A LONG take profit must be above the entry" });
});
export function GET() { return NextResponse.json({ ok: true, data: listPaperPositions() }); }
export async function POST(request: NextRequest) { try { return NextResponse.json({ ok: true, data: await openPaperPosition(input.parse(await request.json())) }); } catch (error) { return NextResponse.json({ ok: false, data: null, message: error instanceof Error ? error.message : "Invalid position" }, { status: 400 }); } }
export async function PATCH(request: NextRequest) { const body = await request.json() as { id?: string }; const position = body.id ? closePaperPosition(body.id) : null; return position ? NextResponse.json({ ok: true, data: position }) : NextResponse.json({ ok: false, data: null, message: "Position not found" }, { status: 404 }); }
