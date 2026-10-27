import { roundHalfEven } from "@/features/calculators/round";

// mulberry32: a 32-bit seeded generator; the same seed gives the same paths, so the same
// inputs give the same percentiles (design §5, "Simulation").
function generator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller: one standard normal draw from two uniform ones; 1 − u keeps the log finite.
function normal(next: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
}

// Nearest rank on sorted values.
function percentile(sorted: readonly number[], p: number): number {
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1] ?? 0;
}

// The 10th, 50th and 90th percentile of the final balance over paths of log-normal monthly
// returns (E4): σ = volatility / √12, μ = ln(1 + rate) / 12 − σ²/2, each month's return
// exp(μ + σz) − 1. Deposits enter at the start of each month; balances are rounded each month.
export function simulate(input: {
  initial: number;
  deposit: number;
  months: number;
  annualRate: number;
  annualVolatility: number;
  paths?: number;
  seed?: number;
}): { p10: number; p50: number; p90: number } {
  const paths = input.paths ?? 2000;
  const next = generator(input.seed ?? 1);
  const sigma = input.annualVolatility / Math.sqrt(12);
  const mu = Math.log(1 + input.annualRate) / 12 - (sigma * sigma) / 2;
  const finals: number[] = [];
  for (let path = 0; path < paths; path++) {
    let balance = input.initial;
    for (let month = 0; month < input.months; month++) {
      const z = sigma === 0 ? 0 : normal(next);
      balance = roundHalfEven(
        (balance + input.deposit) * Math.exp(mu + sigma * z),
      );
    }
    finals.push(balance);
  }
  finals.sort((a, b) => a - b);
  return {
    p10: percentile(finals, 10),
    p50: percentile(finals, 50),
    p90: percentile(finals, 90),
  };
}
