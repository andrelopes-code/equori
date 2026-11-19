import { describe, expect, it } from "vitest";

import { gainTaxLines } from "@/features/portfolio/gain-tax/gain-tax-lines";

const brl = (amount: number) => ({ amount, currency: "BRL" });

function line(pool: string, base: number, rate: number, due: number) {
  return {
    pool,
    gross: brl(0),
    result: brl(0),
    exempt: brl(0),
    loss_used: brl(0),
    loss_carried: brl(0),
    base: brl(base),
    rate_bp: rate,
    tax: brl(due),
    withheld: brl(0),
    due: brl(due),
  };
}

function month(name: string, lines: ReturnType<typeof line>[]) {
  return {
    month: name,
    lines,
    carried_in: brl(0),
    darf: brl(0),
    crypto_carried_in: brl(0),
    crypto_darf: brl(0),
  };
}

describe("gainTaxLines", () => {
  it("lists every pool of every month, in the order of the response", () => {
    const lines = gainTaxLines([
      month("2026-03", [line("day_trade", 4000, 2000, 760)]),
      month("2026-04", [
        line("ordinary", 0, 1500, 0),
        line("fii", 10000, 2000, 2000),
      ]),
    ]);

    expect(lines.map((l) => [l.key, l.month, l.pool, l.due.amount])).toEqual([
      ["2026-03-day_trade", "2026-03", "day_trade", 760],
      ["2026-04-ordinary", "2026-04", "ordinary", 0],
      ["2026-04-fii", "2026-04", "fii", 2000],
    ]);
  });
});
