import { describe, expect, it } from "vitest";

import type { MonthReturn } from "@/features/portfolio/results/model/month-returns";
import { compareMonths } from "@/features/portfolio/results/months-block/month-comparison";

const portfolio: MonthReturn[] = [
  { month: "2025-11", value: 0.01 },
  { month: "2025-12", value: 0.02 },
  { month: "2026-01", value: 0.03 },
];

describe("compareMonths", () => {
  it("keeps the rows of the portfolio without an index", () => {
    const [newest, oldest] = compareMonths(portfolio, null);

    expect(newest?.year).toBe(2026);
    expect(newest?.cells[0]).toBeCloseTo(0.03, 6);
    expect(oldest?.cells[10]).toBeCloseTo(0.01, 6);
    expect(oldest?.total).toBeCloseTo(0.0302, 6);
    expect(oldest?.accumulated).toBeCloseTo(0.0302, 6);
  });

  it("subtracts the month of the index from each cell and each total", () => {
    const index: MonthReturn[] = [
      { month: "2025-11", value: 0.005 },
      { month: "2025-12", value: 0.004975 },
    ];

    const [newest, oldest] = compareMonths(portfolio, index);

    expect(oldest?.cells[10]).toBeCloseTo(0.005, 6);
    expect(oldest?.cells[11]).toBeCloseTo(0.015025, 6);
    expect(oldest?.cells.filter((c) => c === null)).toHaveLength(10);
    expect(oldest?.total).toBeCloseTo(0.0302 - (1.005 * 1.004975 - 1), 6);
    expect(oldest?.accumulated).toBeCloseTo(0.0302 - 0.009999875, 6);
    expect(newest?.cells[0]).toBeNull();
    expect(newest?.total).toBeNull();
  });

  it("leaves a month the index does not cover, and a year it does not hold, empty", () => {
    const index: MonthReturn[] = [{ month: "2025-11", value: 0.005 }];

    const [newest, oldest] = compareMonths(portfolio, index);

    expect(oldest?.cells[10]).toBeCloseTo(0.005, 6);
    expect(oldest?.cells[11]).toBeNull();
    expect(newest?.cells[0]).toBeNull();
    expect(newest?.total).toBeNull();
    expect(newest?.accumulated).toBeNull();
  });
});
