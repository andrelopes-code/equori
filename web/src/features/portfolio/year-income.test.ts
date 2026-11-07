import { describe, expect, it } from "vitest";

import { incomeTotals } from "@/features/portfolio/year-income";

const brl = (amount: number) => ({ amount, currency: "BRL" });
const usd = (amount: number) => ({ amount, currency: "USD" });

const event = (date: string, gross: never, withheld: never) =>
  ({ date, gross, withheld }) as never;

describe("incomeTotals", () => {
  it("adds gross, withheld and net per currency, never converted", () => {
    const items = [
      event("2026-01-10", brl(1000) as never, brl(150) as never),
      event("2026-02-10", brl(500) as never, brl(0) as never),
      event("2026-03-10", usd(200) as never, usd(60) as never),
    ];

    expect(incomeTotals(items)).toEqual({
      gross: [brl(1500), usd(200)],
      withheld: [brl(150), usd(60)],
      net: [brl(1350), usd(140)],
    });
  });

  it("stops at the date when one is given", () => {
    const items = [
      event("2026-01-10", brl(1000) as never, brl(0) as never),
      event("2026-06-10", brl(500) as never, brl(0) as never),
    ];

    expect(incomeTotals(items, "2026-01-10").gross).toEqual([brl(1000)]);
  });

  it("is empty without events", () => {
    expect(incomeTotals([])).toEqual({ gross: [], withheld: [], net: [] });
  });
});
