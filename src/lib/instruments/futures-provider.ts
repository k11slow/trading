import type { Instrument } from "./types";

export type FuturesContract = Instrument & {
  expiry?: string;
  continuous?: boolean;
  openInterest?: number;
};

export interface FuturesProvider {
  readonly name: string;
  readonly configured: boolean;
  listContracts(): Promise<FuturesContract[]>;
  searchContracts(query: string): Promise<FuturesContract[]>;
}

class UnconfiguredFuturesProvider implements FuturesProvider {
  readonly name = process.env.FUTURES_PROVIDER || "Futures Provider";
  readonly configured = false;
  async listContracts(): Promise<FuturesContract[]> { return []; }
  async searchContracts(): Promise<FuturesContract[]> { return []; }
}
const API = "https://api.massive.com";
const apiKey = () => process.env.FUTURES_API_KEY ?? process.env.POLYGON_API_KEY;
const exchanges: Record<string, string> = { XCEC: "COMEX", XNYM: "NYMEX", XCME: "CME", XCBT: "CBOT" };
type Product = { product_code?: string; name?: string; trading_venue?: string; asset_class?: string; asset_sub_class?: string; sector?: string };
type Contract = { ticker?: string; product_code?: string; name?: string; trading_venue?: string; last_trade_date?: string; settlement_date?: string };
type Page<T> = { status?: string; error?: string; results?: T[]; next_url?: string };
const categoryFor = (product?: Product) => { const text = `${product?.asset_class} ${product?.asset_sub_class} ${product?.sector} ${product?.name}`.toLowerCase(); if (/metal|precious|gold|silver|copper/.test(text)) return "Metals"; if (/energy|crude|natural gas|refined|oil/.test(text)) return "Energy"; if (/agric|grain|livestock|dairy|soft|corn|wheat|soy/.test(text)) return "Agriculture"; if (/interest|rate|treasury|bond/.test(text)) return "Rates"; if (/currency|foreign exchange|fx/.test(text)) return "Currencies"; if (/equity|index/.test(text)) return "Indices"; return "Other"; };
const monthLabel = (date?: string) => date ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : undefined;
async function massive<T>(url: string, revalidate: number) { const key = apiKey(); if (!key) throw new Error("FUTURES_API_KEY is not configured"); const parsed = new URL(url, API); parsed.searchParams.set("apiKey", key); const response = await fetch(parsed, { signal: AbortSignal.timeout(15_000), next: { revalidate } }); if (!response.ok) throw new Error(`Massive Futures returned HTTP ${response.status}`); const body = await response.json() as Page<T>; if (body.status === "ERROR") throw new Error(body.error ?? "Massive Futures request failed"); return body; }
let memory: { expiresAt: number; value: FuturesContract[] } | null = null;
export class MassiveFuturesDiscoveryProvider implements FuturesProvider {
  readonly name = "Massive Futures";
  get configured() { return (process.env.FUTURES_PROVIDER ?? "massive").toLowerCase() === "massive" && !!apiKey(); }
  async listContracts() { if (!this.configured) return []; if (memory && memory.expiresAt > Date.now()) return memory.value; const date = new Date().toISOString().slice(0, 10); const horizon = new Date(`${date}T00:00:00Z`); horizon.setUTCFullYear(horizon.getUTCFullYear() + 1); const coreProducts = "GC,SI,HG,CL,NG,ES,NQ,YM,RTY,6E,6B,6J,ZB,ZN,ZC,ZW,ZS"; const [productsBody, broadBody, coreBody] = await Promise.all([massive<Product>(`/futures/v1/products?date=${date}&type=single&limit=50000`, 43_200), massive<Contract>(`/futures/v1/contracts?date=${date}&active=true&type=single&last_trade_date.gte=${date}&last_trade_date.lt=${horizon.toISOString().slice(0, 10)}&limit=1000&sort=ticker.asc`, 21_600), massive<Contract>(`/futures/v1/contracts?date=${date}&active=true&type=single&product_code.any_of=${coreProducts}&last_trade_date.gte=${date}&last_trade_date.lt=${horizon.toISOString().slice(0, 10)}&limit=1000&sort=ticker.asc`, 21_600)]); const contracts = [...(broadBody.results ?? []), ...(coreBody.results ?? [])]; const products = new Map((productsBody.results ?? []).filter((row) => row.product_code).map((row) => [row.product_code!, row])); const unique = new Map<string, FuturesContract>(); for (const row of contracts) { if (!row.ticker || !row.product_code) continue; const product = products.get(row.product_code); const expiry = row.last_trade_date ?? row.settlement_date; unique.set(row.ticker, { id: `massive:${row.ticker}`, symbol: row.ticker, baseAsset: row.product_code, quoteAsset: "USD", displayName: product?.name ?? row.name ?? `${row.product_code} Futures`, marketCategory: "Futures", exchange: exchanges[row.trading_venue ?? product?.trading_venue ?? ""] ?? row.trading_venue ?? product?.trading_venue ?? "CME", provider: this.name, assetType: "Futures Contract", status: "ACTIVE", isTradable: true, quoteCurrency: "USD", source: "LIVE", productCode: row.product_code, expiry, contractMonth: monthLabel(expiry), futuresCategory: categoryFor(product), continuous: false }); } const value = [...unique.values()]; memory = { expiresAt: Date.now() + 21_600_000, value }; return value; }
  async searchContracts(query: string) { const text = query.toLowerCase(); return (await this.listContracts()).filter((row) => `${row.symbol} ${row.displayName} ${row.productCode} ${row.exchange}`.toLowerCase().includes(text)).slice(0, 100); }
}
const massiveProvider = new MassiveFuturesDiscoveryProvider();
export const futuresDiscoveryProvider: FuturesProvider = massiveProvider.configured ? massiveProvider : new UnconfiguredFuturesProvider();
export const futuresConfigurationMessage = "Massive Futures is not configured. Set FUTURES_PROVIDER=massive and FUTURES_API_KEY. Create a key at massive.com; Futures Basic is sufficient for development reference data and delayed aggregates.";
