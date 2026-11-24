import { describe, expect, it } from "vitest";

import type { MonthReturn } from "@/features/portfolio/results/model/month-returns";
import {
  annualRate,
  largestFall,
  pointsApart,
  realReturn,
  volatility,
} from "@/features/portfolio/results/model/return-figures";

function point(date: string, return_bp: number) {
  return { date, value: 0, flows: 0, return_bp };
}

function alternating(count: number): MonthReturn[] {
  return Array.from({ length: count }, (_, i) => ({
    month: `2025-${String(i + 1).padStart(2, "0")}`,
    value: i % 2 === 0 ? 0.01 : 0.03,
  }));
}

describe("largestFall", () => {
  it("reports the lowest level over its running maximum, with the dates", () => {
    const got = largestFall(
      [0, 1000, -100, 500, 2000].map((bp, i) => ({
        date: `2026-0${String(i + 1)}-28`,
        return_bp: bp,
      })),
    );

    expect(got?.value).toBeCloseTo(-0.1, 6);
    expect(got?.from).toBe("2026-02-28");
    expect(got?.to).toBe("2026-03-28");
  });

  it("is null for a series that only rises", () => {
    const rising = [0, 100, 200].map((bp, i) =>
      point(`2026-0${String(i + 1)}-28`, bp),
    );

    expect(largestFall(rising)).toBeNull();
  });

  it("skips a point without return_bp", () => {
    expect(largestFall([{ date: "2026-01-28" }])).toBeNull();
  });
});

describe("volatility", () => {
  it("is the sample deviation of the months times the root of 12", () => {
    expect(volatility(alternating(12))).toBeCloseTo(0.036181, 6);
  });

  it("is null under 12 months", () => {
    expect(volatility(alternating(11))).toBeNull();
  });
});

describe("annualRate", () => {
  it("annualizes the return over 365 days a year", () => {
    expect(annualRate(0.21, 730)).toBeCloseTo(0.1, 6);
  });

  it("is null under 365 days", () => {
    expect(annualRate(0.21, 364)).toBeNull();
  });
});

describe("pointsApart", () => {
  const portfolio = [point("2026-11-19", 2400), point("2026-11-24", 2500)];

  it("subtracts the index at the last date both hold", () => {
    const index = [
      { date: "2026-11-18", return_bp: 900 },
      { date: "2026-11-19", return_bp: 1000 },
    ];

    expect(pointsApart(portfolio, index)).toBeCloseTo(0.14, 6);
  });

  it("is null when no date is shared", () => {
    expect(
      pointsApart(portfolio, [{ date: "2026-11-01", return_bp: 1 }]),
    ).toBeNull();
  });
});

describe("realReturn", () => {
  it("deflates the portfolio by the inflation at the last shared date", () => {
    const got = realReturn(
      [point("2025-12-31", 302)],
      [
        { date: "2025-11-30", return_bp: 50 },
        { date: "2025-12-31", return_bp: 90 },
      ],
    );

    expect(got?.value).toBeCloseTo(1.0302 / 1.009 - 1, 6);
    expect(got?.until).toBe("2025-12-31");
  });

  it("is null without a shared date", () => {
    expect(realReturn([point("2025-12-31", 302)], [])).toBeNull();
  });
});
