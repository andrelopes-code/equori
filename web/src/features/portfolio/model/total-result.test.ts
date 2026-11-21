import { describe, expect, it } from "vitest";

import { rowTotal, totalFigure } from "@/features/portfolio/model/total-result";

const brl = (amount: number) => ({ amount, currency: "BRL" });
const usd = (amount: number) => ({ amount, currency: "USD" });

const position = (parts: { realized?: unknown; income?: unknown }) =>
  ({ cost_basis: brl(100827), ...parts }) as never;

describe("rowTotal", () => {
  it("adds the gain, the results of the sales and the income (TR3)", () => {
    expect(
      rowTotal(-7227, position({ realized: brl(3377), income: brl(1000) })),
    ).toEqual({ total: -2850, outside: false });
  });

  it("states the gain alone when the account has no sale nor income", () => {
    expect(rowTotal(500, position({}))).toEqual({ total: 500, outside: false });
  });

  it("states none without a gain", () => {
    expect(rowTotal(undefined, position({ income: brl(1000) }))).toEqual({
      total: undefined,
      outside: false,
    });
  });

  it("states none, and why, with a part in another currency (C3)", () => {
    expect(rowTotal(500, position({ income: usd(300) }))).toEqual({
      total: undefined,
      outside: true,
    });
  });
});

describe("totalFigure", () => {
  it("adds the parts in the valuation currency (TR4)", () => {
    expect(
      totalFigure(-7227, { realized: [brl(5377)], income: [brl(4712)] }, "BRL"),
    ).toEqual({ value: 2862, realized: 5377, income: 4712, outside: [] });
  });

  it("leaves a part in another currency out and names it (C2, C3)", () => {
    expect(
      totalFigure(
        1000,
        { realized: [brl(200), usd(900)], income: [usd(300)] },
        "BRL",
      ),
    ).toEqual({
      value: 1200,
      realized: 200,
      income: 0,
      outside: [usd(900), usd(300)],
    });
  });

  it("reads zero when nothing was sold nor paid", () => {
    expect(totalFigure(0, { realized: [], income: [] }, "BRL")).toEqual({
      value: 0,
      realized: 0,
      income: 0,
      outside: [],
    });
  });
});
