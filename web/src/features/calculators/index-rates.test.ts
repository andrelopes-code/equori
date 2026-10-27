import { describe, expect, it } from "vitest";

import {
  accumulated,
  percentOfDaily,
  spreadOverDaily,
  trailingDaily,
  trailingMonthly,
  type IndexRate,
} from "@/features/calculators/index-rates";

// IPCA of 2020, SGS series 433, as fractions.
const ipca2020: IndexRate[] = [
  0.21, 0.25, 0.07, -0.31, -0.38, 0.26, 0.36, 0.24, 0.64, 0.86, 0.89, 1.35,
].map((p, i) => ({
  date: `2020-${String(i + 1).padStart(2, "0")}-01`,
  rate: p / 100,
}));

// 0.04% on each weekday from 2025-01-02 to 2025-12-31, then on 2026-01-02.
function weekdays(): IndexRate[] {
  const out: IndexRate[] = [];
  for (let d = new Date(Date.UTC(2025, 0, 2)); ;) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6)
      out.push({ date: d.toISOString().slice(0, 10), rate: 0.0004 });
    if (d.toISOString().startsWith("2026-01-02")) break;
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}

describe("index rates", () => {
  it("accumulates the IPCA of 2020", () => {
    expect(Math.abs(accumulated(ipca2020) - 0.04517342)).toBeLessThan(1e-8);
  });

  it("needs 12 months for the trailing monthly rate", () => {
    expect(trailingMonthly(ipca2020.slice(1))).toBeNull();
    expect(trailingMonthly(ipca2020)).toBeCloseTo(0.04517342, 8);
  });

  it("takes the dates after the last one minus a year for the trailing daily rate", () => {
    const rates = weekdays();
    // From 2025-01-03 to 2026-01-02.
    const n = rates.filter((r) => r.date > "2025-01-02").length;
    expect(
      Math.abs((trailingDaily(rates) ?? 0) - (1.0004 ** n - 1)),
    ).toBeLessThan(1e-12);
    expect(
      Math.abs((percentOfDaily(rates, 1.1) ?? 0) - (1.00044 ** n - 1)),
    ).toBeLessThan(1e-12);
  });

  it("repeats the last daily rate over the days of the trailing year for the current rate", () => {
    const rates = weekdays();
    rates[rates.length - 1] = { date: "2026-01-02", rate: 0.0005 };
    const n = rates.filter((r) => r.date > "2025-01-02").length;
    expect(
      Math.abs(
        (percentOfDaily(rates, 1.1, "current") ?? 0) - (1.00055 ** n - 1),
      ),
    ).toBeLessThan(1e-12);
    expect(spreadOverDaily(rates, 0.02, false, "current")).toBeCloseTo(
      1.0005 ** n * 1.02 - 1,
      12,
    );
    expect(percentOfDaily(rates.slice(100), 1, "current")).toBeNull();
  });

  it("needs a year of daily data", () => {
    expect(trailingDaily(weekdays().slice(100))).toBeNull();
  });

  it("compounds a spread with an index of business days over the year", () => {
    const year = trailingDaily(weekdays()) ?? Number.NaN;
    expect(spreadOverDaily(weekdays(), 0.02, false)).toBeCloseTo(
      (1 + year) * 1.02 - 1,
      12,
    );
  });

  it("adds a 360th of the spread to each calendar day of an actual/360 index", () => {
    const days: IndexRate[] = [];
    for (let i = 0; i <= 365; i++)
      days.push({
        date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
        rate: 0.0001,
      });
    // 365 days after 2025-01-01 at 0.01% plus 2%/360 each.
    expect(spreadOverDaily(days, 0.02, true)).toBeCloseTo(
      0.05841590614385339,
      12,
    );
  });
});
