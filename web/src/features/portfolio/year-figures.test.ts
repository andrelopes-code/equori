import { describe, expect, it } from "vitest";

import {
  incomeChart,
  incomeTaxRows,
  salesTotals,
} from "@/features/portfolio/year-figures";

const brl = (amount: number) => ({ amount, currency: "BRL" });
const usd = (amount: number) => ({ amount, currency: "USD" });

const event = (
  date: string,
  instrument: string,
  gross: { amount: number; currency: string },
  withheld: { amount: number; currency: string },
  income_type = "dividend",
  tax_treatment: string | null = "exempt",
) =>
  ({ date, instrument, gross, withheld, income_type, tax_treatment }) as never;

const sale = (month: string, proceeds: number, result: number) =>
  ({ month, proceeds: brl(proceeds), result: brl(result) }) as never;

describe("incomeChart", () => {
  const items = [
    event("2026-01-10", "ITUB4", brl(1000), brl(150)),
    event("2026-01-20", "HGLG11", brl(500), brl(0)),
    event("2026-03-10", "ITUB4", brl(200), brl(0)),
    event("2026-03-11", "AAPL", usd(900), usd(0)),
  ];

  it("reads the currency most events pay in", () => {
    expect(incomeChart(items, "2026-01-01", "2026-04-30").currency).toBe("BRL");
  });

  it("states every month of the period, those without income at zero", () => {
    expect(incomeChart(items, "2026-01-01", "2026-04-30").months).toEqual([
      { month: "2026-01", net: 1350 },
      { month: "2026-02", net: 0 },
      { month: "2026-03", net: 200 },
      { month: "2026-04", net: 0 },
    ]);
  });

  it("crosses a year in a tax year of another calendar", () => {
    const months = incomeChart([], "2026-11-06", "2027-02-05").months;

    expect(months.map((m) => m.month)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("ranks the investments, largest first, and cuts them at ten", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      event("2026-01-10", `T${String(i)}`, brl(100 + i), brl(0)),
    );
    const chart = incomeChart(many, "2026-01-01", "2026-01-31");

    expect(chart.investments).toHaveLength(10);
    expect(chart.investments[0]).toEqual({ code: "T11", net: 111 });
    expect(chart.total).toBe(12);
  });

  it("is empty of a currency without events", () => {
    expect(
      incomeChart([], "2026-01-01", "2026-01-31").currency,
    ).toBeUndefined();
  });
});

describe("incomeTaxRows", () => {
  it("adds gross, withheld and net by type, treatment and currency", () => {
    const rows = incomeTaxRows([
      event("2026-01-10", "ITUB4", brl(1000), brl(150), "jcp", "exclusive"),
      event("2026-02-10", "ITUB4", brl(1000), brl(150), "jcp", "exclusive"),
      event("2026-03-10", "HGLG11", brl(500), brl(0)),
      event("2026-03-10", "AAPL", usd(900), usd(90), "dividend", null),
    ]);

    expect(rows).toEqual([
      {
        type: "dividend",
        treatment: null,
        gross: usd(900),
        withheld: usd(90),
        net: usd(810),
      },
      {
        type: "dividend",
        treatment: "exempt",
        gross: brl(500),
        withheld: brl(0),
        net: brl(500),
      },
      {
        type: "jcp",
        treatment: "exclusive",
        gross: brl(2000),
        withheld: brl(300),
        net: brl(1700),
      },
    ]);
  });
});

describe("salesTotals", () => {
  it("adds the result and the amount sold, and counts the months", () => {
    expect(
      salesTotals([
        sale("2026-02", 1000, -200),
        sale("2026-02", 500, 100),
        sale("2026-06", 300, 50),
      ]),
    ).toEqual({
      result: [brl(-50)],
      sold: [brl(1800)],
      count: 3,
      months: 2,
    });
  });
});
