import { describe, expect, it } from "vitest";

import type { MarketCurve } from "@/features/calculators/api";
import { breakEven } from "@/features/calculators/indexer-comparison/break-even/break-even";
import { breakEvenItems } from "@/features/calculators/indexer-comparison/break-even/break-even-items";
import { compare } from "@/features/calculators/indexer-comparison/compare";
import type {
  IndexData,
  Security,
} from "@/features/calculators/indexer-comparison/security";
import { expectedIndexRate } from "@/features/calculators/indexer-comparison/security-rate";

// 261 weekdays of a daily index at 1.03^(1/261) a day, from 2025-10-01 to 2026-10-16.
const rates: { date: string; rate: number }[] = [];
for (
  let d = new Date(Date.UTC(2025, 9, 1));
  d <= new Date(Date.UTC(2026, 9, 16));
  d = new Date(d.getTime() + 86_400_000)
) {
  if (d.getUTCDay() % 6 !== 0)
    rates.push({
      date: d.toISOString().slice(0, 10),
      rate: 1.03 ** (1 / 261) - 1,
    });
}

const cdi: IndexData = {
  id: "cdi",
  period: "day",
  rates,
  points: [],
  surveyDate: "2026-11-13",
  dailySpread: false,
};

const curve: MarketCurve = {
  id: "br_tesouro_prefixed",
  kind: "nominal",
  index: null,
  currency: "BRL",
  baseDate: "2026-11-16",
  points: [
    { maturity: "2028-01-01", rate: 0.128 },
    { maturity: "2030-01-01", rate: 0.134 },
  ],
};

const fixed: Security = { form: "fixed", rate: 0.08, taxed: true };
const percent: Security = {
  form: "percent",
  index: "cdi",
  rate: 1.4,
  taxed: true,
};
const securities: Security[] = [fixed, percent];

const input = {
  securities,
  reference: 0,
  indexes: new Map([["cdi", cdi]]),
  curves: [curve],
  currency: "BRL",
  maturity: "2028-11-07",
  days: 720,
  taxBp: 1750,
};

describe("breakEvenItems", () => {
  it("gives one item per floating security, with its three figures", () => {
    const rows = compare({ ...input, amount: 1_000_000 });

    const items = breakEvenItems({ ...input, rows });

    expect(items).toHaveLength(1);
    expect(items[0]?.position).toBe(1);
    expect(items[0]?.index).toBe("cdi");
    expect(items[0]?.breakEven).toBe(
      breakEven({
        security: percent,
        data: cdi,
        reference: fixed,
        referenceRate: 0.08,
        days: 720,
        taxBp: 1750,
      }),
    );
    expect(items[0]?.expected).toBe(expectedIndexRate(cdi, 24));
    expect(items[0]?.surveyDate).toBe("2026-11-13");
    expect(items[0]?.market?.date).toBe("2026-11-16");
  });

  it("has no break-even when the reference rate is unknown", () => {
    const items = breakEvenItems({ ...input, rows: [null, null] });

    expect(items[0]?.breakEven).toBeNull();
  });

  it("leaves out the reference itself and reads a missing index as no figure", () => {
    const floating: Security[] = [
      { form: "percent", index: "cdi", rate: 1.1, taxed: true },
      { form: "spread", index: "xx", rate: 0.05, taxed: true },
    ];
    const rows = compare({ ...input, securities: floating, amount: 1_000_000 });

    const items = breakEvenItems({ ...input, securities: floating, rows });

    expect(items.map((i) => i.position)).toEqual([1]);
    expect(items[0]).toMatchObject({ breakEven: null, expected: null });
  });
});
