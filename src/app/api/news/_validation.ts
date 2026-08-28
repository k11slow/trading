import { z } from "zod";
export const categorySchema = z.enum(["Forex", "Stocks", "Futures", "Crypto", "Meme Coins"]);
export const symbolSchema = z.string().trim().min(1).max(32).regex(/^[A-Z0-9./_-]+$/i);
export const impactSchema = z.enum(["low", "medium", "high"]);
export function apiError(error: unknown) { return error instanceof z.ZodError ? { message: "Invalid request parameters", status: 400 } : { message: error instanceof Error ? error.message : "Request failed", status: 500 }; }
