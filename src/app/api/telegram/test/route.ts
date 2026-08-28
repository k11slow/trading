import { NextResponse } from "next/server";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";
export async function GET() { return NextResponse.json({ ok: true, configured: telegramConfigured() }); }
export async function POST() {
  try {
    await sendTelegramMessage([
      "🧪 <b>FORMAT PREVIEW — NOT A SIGNAL</b>",
      "",
      "🟢 <b>STRONG BUY</b>",
      "",
      "<b>BONK/USDT</b>  •  LONG",
      "<code>BINANCE:BONKUSDT</code>",
      "",
      "<b>ORDER TICKET</b>",
      "Order         <b>LIMIT BUY</b>",
      "Entry         <code>0.00000310</code>",
      "Stop loss     <code>0.00000307</code>  -0.88%",
      "Take profit   <code>0.00000321</code>  +3.55%",
      "",
      "R:R           <b>1:4.01</b>",
      "AI score      <b>89/100</b>",
    ].join("\n"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Telegram test failed" },
      { status: 400 },
    );
  }
}
