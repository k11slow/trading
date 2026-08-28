import { NextResponse } from "next/server";
import { providerCapabilities } from "@/lib/instruments/capabilities";
export async function GET() {
  const data = providerCapabilities.map((provider) => ({
    ...provider,
    connected:
      provider.provider === "Massive Futures" ? !!(process.env.FUTURES_API_KEY ?? process.env.POLYGON_API_KEY)
        : provider.provider === "Twelve Data" ? !!process.env.TWELVE_DATA_API_KEY
          : provider.provider === "Finnhub" ? !!process.env.FINNHUB_API_KEY
            : true,
    configuration: provider.provider === "Massive Futures" && !(process.env.FUTURES_API_KEY ?? process.env.POLYGON_API_KEY)
      ? "Massive Futures: FUTURES_PROVIDER=massive, FUTURES_API_KEY from massive.com" : undefined,
  }));
  return NextResponse.json({ ok: true, data });
}
