import { afterEach, describe, expect, it } from "vitest";
import type { MarketSymbol, Quote } from "@/lib/market-data/types";
import type { Candle } from "@/lib/market-data/types";
import type {
  MultiTimeframePatternAnalysis,
  MultiTimeframeStructureAnalysis,
  PatternDetection,
  SupportResistanceZone,
  TimeframeStructureAnalysis,
  TrendDirection,
} from "@/lib/analysis";
import { calculateSetup } from "@/lib/ai/setup-engine";
import { buildTradingCoach } from "@/lib/ai/coach";
import { fallbackExplanation } from "@/lib/ai/fallback";
import { validateExplanationAgainstFacts } from "@/lib/ai/validation";
import { explainTradingSetup } from "@/lib/ai/trading-assistant";

const asset: MarketSymbol = {
  symbol: "TEST/USDT",
  name: "Test",
  exchange: "TEST",
  category: "Crypto",
  price: 100,
  change: 0,
  decimals: 2,
  volatility: 0.01,
};
const quote: Quote = {
  symbol: asset.symbol,
  price: 100,
  change: 0,
  changePercent: 0,
  timestamp: 1000,
};
const zone = (
  type: "support" | "resistance",
  low: number,
  high: number,
): SupportResistanceZone => ({
  id: `${type}-${low}`,
  type,
  low,
  high,
  midpoint: (low + high) / 2,
  strength: 90,
  touches: 3,
  lastTouchedAt: 800,
});
const timeframe = (
  name: "4H" | "1H" | "15m",
  trend: TrendDirection,
  zones: SupportResistanceZone[] = [],
): TimeframeStructureAnalysis => ({
  timeframe: name,
  swings: [],
  labels: [],
  trend: {
    trend,
    confidence: trend === "sideways" ? 45 : 92,
    bullishSignals: trend === "bullish" ? 6 : 0,
    bearishSignals: trend === "bearish" ? 6 : 0,
  },
  zones,
  roleReversals: [],
  latestStructure:
    trend === "bullish" ? "HH + HL" : trend === "bearish" ? "LH + LL" : "Mixed",
  analyzedThrough: 900,
});
const pattern = (
  direction: "bullish" | "bearish",
  status: "confirmed" | "forming" = "confirmed",
  score = 90,
): PatternDetection => ({
  id: `${direction}-${status}`,
  name: direction === "bullish" ? "Bullish Engulfing" : "Bearish Engulfing",
  abbreviation: "BE",
  direction,
  timeframe: "15m",
  candleIndex: 20,
  timestamp: 900,
  confidence: score,
  strength: "high",
  status,
  reason: [],
  explanation: "",
  context: direction === "bullish" ? "Near support" : "Near resistance",
  againstMajorTrend: false,
  debug: {
    range: 2,
    body: 1.5,
    upperWick: 0.2,
    lowerWick: 0.3,
    bodyRatio: 0.75,
    upperWickRatio: 0.1,
    lowerWickRatio: 0.15,
    bullish: direction === "bullish",
    bearish: direction === "bearish",
    averageRange: 1.5,
    shapeScore: 90,
    locationScore: 90,
    trendAlignmentScore: 90,
    finalScore: score,
  },
});
function input(
  trend: TrendDirection,
  zones: SupportResistanceZone[],
  detected: PatternDetection | null,
) {
  const structure: MultiTimeframeStructureAnalysis = {
    symbol: asset.symbol,
    generatedAt: 1000,
    byTimeframe: {
      "4H": timeframe("4H", trend),
      "1H": timeframe("1H", trend, zones),
      "15m": timeframe("15m", trend),
    },
  };
  const patterns: MultiTimeframePatternAnalysis = {
    symbol: asset.symbol,
    generatedAt: 1000,
    byTimeframe: {
      "4H": { timeframe: "4H", patterns: [], mostRelevant: null },
      "1H": { timeframe: "1H", patterns: [], mostRelevant: null },
      "15m": {
        timeframe: "15m",
        patterns: detected ? [detected] : [],
        mostRelevant: detected,
      },
    },
    setupConditions: [],
  };
  return { asset, quote, structure, patterns };
}

describe("deterministic setup engine", () => {
  it("returns BUY for a clear bullish setup", () => {
    const result = calculateSetup(
      input(
        "bullish",
        [zone("support", 99, 100), zone("resistance", 109, 111)],
        pattern("bullish"),
      ),
    );
    expect(result.preference).toBe("BUY");
    expect(result.buyScore.total).toBeGreaterThanOrEqual(80);
  });
  it("returns SELL for a clear bearish setup", () => {
    const result = calculateSetup(
      input(
        "bearish",
        [zone("support", 89, 91), zone("resistance", 100, 101)],
        pattern("bearish"),
      ),
    );
    expect(result.preference).toBe("SELL");
    expect(result.sellScore.total).toBeGreaterThanOrEqual(80);
  });
  it("returns WAIT for a mixed market", () => {
    const result = calculateSetup(input("sideways", [], null));
    expect(result.preference).toBe("WAIT");
  });
  it("keeps a strong pattern at a bad location below action quality", () => {
    const result = calculateSetup(
      input("bullish", [], pattern("bullish", "confirmed", 95)),
    );
    expect(result.preference).toBe("WAIT");
    expect(result.buyScore.components.location1H).toBeLessThan(10);
  });
  it("returns WAIT when risk/reward is poor despite other alignment", () => {
    const result = calculateSetup(
      input(
        "bullish",
        [zone("support", 99, 100), zone("resistance", 100.4, 100.8)],
        pattern("bullish"),
      ),
    );
    expect(result.buyScore.total).toBeGreaterThanOrEqual(70);
    expect(result.riskReward.ratio).toBeLessThan(1.2);
    expect(result.preference).toBe("WAIT");
  });
  it("does not treat a forming bullish engulfing as confirmation", () => {
    const result = calculateSetup(
      input(
        "bullish",
        [zone("support", 99, 100), zone("resistance", 109, 111)],
        pattern("bullish", "forming"),
      ),
    );
    expect(result.confirmation15M.confirmed).toBe(false);
    expect(result.confirmation15M.forming).toBe(true);
    expect(result.preference).toBe("WAIT");
  });
  it("keeps the latest closed confirmation when the live candle is also forming a pattern", () => {
    const base = input(
      "bullish",
      [zone("support", 99, 100), zone("resistance", 109, 111)],
      pattern("bullish"),
    );
    const livePattern = {
      ...pattern("bearish", "forming", 80),
      timestamp: 1000,
    };
    const m15Patterns = base.patterns.byTimeframe["15m"]!;
    m15Patterns.patterns = [
      livePattern,
      pattern("bullish"),
    ];
    m15Patterns.mostRelevant = livePattern;

    const result = calculateSetup(base);

    expect(result.confirmation15M.pattern).toBe("Bullish Engulfing");
    expect(result.confirmation15M.confirmed).toBe(true);
    expect(result.confirmation15M.forming).toBe(false);
    expect(result.preference).toBe("BUY");
  });
  it("changes a strong technical BUY to WAIT during high news risk", () => {
    const base = input(
      "bullish",
      [zone("support", 99, 100), zone("resistance", 109, 111)],
      pattern("bullish"),
    );
    const result = calculateSetup({
      ...base,
      newsRisk: {
        score: 88,
        label: "high",
        reasons: ["US CPI releases in 15m"],
        assessedAt: 1000,
        upcomingEvents: [],
        relevantBreakingNews: [],
        technicalPenalty: 20,
        nextMajorEvent: null,
      },
    });
    expect(result.technicalPreference).toBe("BUY");
    expect(result.preference).toBe("WAIT");
    expect(result.setupScore).toBe(result.technicalSetupScore - 20);
  });
  it("continues technical analysis when news is unavailable", () => {
    const base = input(
      "bullish",
      [zone("support", 99, 100), zone("resistance", 109, 111)],
      pattern("bullish"),
    );
    const result = calculateSetup({
      ...base,
      newsRisk: {
        score: 0,
        label: "unavailable",
        reasons: ["Provider unavailable"],
        assessedAt: 1000,
        upcomingEvents: [],
        relevantBreakingNews: [],
        technicalPenalty: 0,
        nextMajorEvent: null,
      },
    });
    expect(result.preference).toBe("BUY");
    expect(result.setupScore).toBe(result.technicalSetupScore);
  });
  it("scores a confirmed bullish setup materially above 75", () => {
    const result = calculateSetup(
      input(
        "bullish",
        [zone("support", 99, 100), zone("resistance", 109, 111)],
        pattern("bullish"),
      ),
    );
    expect(result.buyScore.total).toBeGreaterThanOrEqual(75);
    expect(result.buyScore.total).not.toBeLessThan(60);
  });
  it("scores a confirmed bearish setup materially above 75", () => {
    const result = calculateSetup(
      input(
        "bearish",
        [zone("support", 89, 91), zone("resistance", 100, 101)],
        pattern("bearish"),
      ),
    );
    expect(result.sellScore.total).toBeGreaterThanOrEqual(75);
    expect(result.sellScore.total).not.toBeLessThan(60);
  });
  it("scores forming confirmation below confirmed confirmation", () => {
    const zones = [zone("support", 99, 100), zone("resistance", 109, 111)];
    const confirmed = calculateSetup(
      input("bullish", zones, pattern("bullish")),
    );
    const forming = calculateSetup(
      input("bullish", zones, pattern("bullish", "forming")),
    );
    expect(forming.buyScore.total).toBeLessThan(confirmed.buyScore.total);
    expect(forming.buyScore.components.confirmation15M).toBeLessThanOrEqual(6);
  });
  it("awards zero risk/reward points for invalid geometry", () => {
    const result = calculateSetup(
      input(
        "bullish",
        [zone("support", 101, 102), zone("resistance", 98, 99)],
        pattern("bullish"),
      ),
    );
    expect(result.riskReward.valid).toBe(false);
    expect(result.buyScore.components.riskReward).toBe(0);
  });
  it("awards very few 1H points in the middle of a range", () => {
    const result = calculateSetup(
      input(
        "bullish",
        [zone("support", 89, 91), zone("resistance", 109, 111)],
        pattern("bullish"),
      ),
    );
    expect(result.setup1H.location).toBe("middle");
    expect(result.buyScore.components.location1H).toBeLessThanOrEqual(3);
  });
});

describe("AI safety and fallback", () => {
  const facts = calculateSetup(
    input(
      "bullish",
      [zone("support", 99, 100), zone("resistance", 109, 111)],
      pattern("bullish"),
    ),
  );
  const originalKey = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });
  it("uses the rule-based fallback when OpenAI is unavailable", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await explainTradingSetup(facts, "standard");
    expect(result.source).toBe("rule-based");
    expect(result.analysis.preference).toBe(facts.preference);
  });
  it("rejects output that overrides calculated facts", () => {
    const output = {
      ...fallbackExplanation(facts),
      preference: "SELL" as const,
    };
    expect(() => validateExplanationAgainstFacts(output, facts)).toThrow(
      /override/,
    );
  });
  it("rejects explanations that contradict the calculated trend", () => {
    const output = {
      ...fallbackExplanation(facts),
      summary: "The 4H trend is bearish.",
    };
    expect(() => validateExplanationAgainstFacts(output, facts)).toThrow(
      /contradicted/,
    );
  });
});

describe("beginner trading coach", () => {
  it("explains a strong bullish setup as a strong buy", () => {
    const facts = calculateSetup(
      input(
        "bullish",
        [zone("support", 99, 100), zone("resistance", 109, 111)],
        pattern("bullish"),
      ),
    );
    const coach = buildTradingCoach(facts);
    expect(coach.view).toBe("STRONG BUY");
    expect(coach.marketNow.toLowerCase()).toContain("buyers");
    expect(coach.flow[2].title).toBe("CONFIRMED");
  });
  it("explains a strong bearish setup as a strong sell", () => {
    const facts = calculateSetup(
      input(
        "bearish",
        [zone("support", 89, 91), zone("resistance", 100, 101)],
        pattern("bearish"),
      ),
    );
    const coach = buildTradingCoach(facts);
    expect(coach.view).toBe("STRONG SELL");
    expect(coach.marketNow.toLowerCase()).toContain("sellers");
  });
  it("says neither side controls a sideways market", () => {
    const coach = buildTradingCoach(
      calculateSetup(input("sideways", [], null)),
    );
    expect(coach.marketNow).toMatch(/Neither buyers nor sellers/i);
    expect(coach.view).toBe("WAIT");
  });
  it("explicitly waits for a forming candle to close", () => {
    const facts = calculateSetup(
      input(
        "bullish",
        [zone("support", 99, 100), zone("resistance", 109, 111)],
        pattern("bullish", "forming"),
      ),
    );
    const coach = buildTradingCoach(facts);
    expect(coach.action).toMatch(/candle to close/i);
    expect(coach.flow[2].title).toBe("STILL FORMING");
  });
  it("keeps the coach useful when news is unavailable", () => {
    const facts = calculateSetup(
      input(
        "bullish",
        [zone("support", 99, 100), zone("resistance", 109, 111)],
        pattern("bullish"),
      ),
    );
    const coach = buildTradingCoach(facts);
    expect(facts.newsRisk.label).toBe("unavailable");
    expect(coach.action.length).toBeGreaterThan(20);
  });
  it("warns beginners not to chase a large green candle into resistance", () => {
    const facts = calculateSetup(
      input(
        "bullish",
        [zone("support", 90, 91), zone("resistance", 100, 101)],
        pattern("bullish"),
      ),
    );
    const candles: Candle[] = [
      {
        time: 900,
        open: 96,
        high: 100.2,
        low: 95.8,
        close: 100,
        volume: 1_000,
      },
    ];
    const coach = buildTradingCoach(facts, "beginner", candles);
    expect(coach.action).toMatch(/do not chase/i);
  });
  it("explains the actual latest five candles and marks the current one forming", () => {
    const facts = calculateSetup(input("sideways", [], null));
    const candles: Candle[] = Array.from({ length: 5 }, (_, index) => ({
      time: 600 + index * 60,
      open: 100 + index,
      high: 102 + index,
      low: 99 + index,
      close: 101.7 + index,
      volume: 100,
    }));
    const coach = buildTradingCoach(facts, "beginner", candles);
    expect(coach.candleStory).toHaveLength(5);
    expect(coach.candleStory[0]).toMatch(/buyers pushed/i);
    expect(coach.candleStory[4]).toMatch(/still forming/i);
  });
});
