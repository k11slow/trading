const memeAssets = new Set(["DOGE", "SHIB", "PEPE", "TRUMP", "BONK", "FLOKI", "WIF", "BRETT", "MOG", "TURBO", "BABYDOGE", "MEME", "NEIRO", "POPCAT", "PNUT", "MEW", "BOME", "PENGU", "FARTCOIN", "AI16Z", "SPX", "DEGEN"]);
const memeNameSignals = ["doge", "shib", "pepe", "meme", "floki", "bonk", "wif", "trump", "cat", "inu", "frog"];
export function isMemeAsset(baseAsset: string, name = "") { const base = baseAsset.toUpperCase(); return memeAssets.has(base) || memeNameSignals.some((signal) => name.toLowerCase().includes(signal)); }
