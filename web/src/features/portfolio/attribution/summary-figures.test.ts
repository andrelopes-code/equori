import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  signTone,
  summaryFigures,
} from "@/features/portfolio/attribution/summary-figures";

type AttributionYear = components["schemas"]["AttributionYear"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

const year: AttributionYear = {
  year: 2026,
  from: "2026-01-01",
  to: "2026-11-01",
  since: "2026-01-01",
  result: brl(44700),
  return_bp: 449,
  rate: {
    index: "cdi",
    until: "2026-10-30",
    return_bp: 440,
    result: brl(44000),
    index_bp: 1050,
    index_result: brl(105000),
  },
  inflation: {
    index: "ipca",
    until: "2026-11-01",
    return_bp: 449,
    result: brl(44700),
    index_bp: 400,
    index_result: brl(40000),
    real_bp: 47,
  },
};

describe("summaryFigures", () => {
  it("lines up the portfolio, the CDI and the IPCA on one axis, with the CDI's last day", () => {
    const got = summaryFigures(year);

    expect(got.lines).toEqual([
      { kind: "portfolio", bp: 449, amount: 44700 },
      {
        kind: "rate",
        index: "cdi",
        until: "2026-10-30",
        bp: 1050,
        amount: 105000,
      },
      { kind: "inflation", index: "ipca", bp: 400, amount: 40000 },
    ]);
    expect([got.low, got.high]).toEqual([0, 1050]);
    // 44,000 of the portfolio to 10/30 against 105,000 at the CDI.
    expect(got.rateDiff).toEqual({
      amount: -61000,
      index: "cdi",
      until: "2026-10-30",
    });
    expect(got.real).toEqual({ bp: 47, index: "ipca" });
  });

  it("keeps the portfolio alone, without a rate, when no index covers the year", () => {
    const got = summaryFigures({
      year: 2021,
      from: "2021-01-01",
      to: "2021-12-31",
      result: brl(-652),
    });

    expect(got.lines).toEqual([{ kind: "portfolio", amount: -652 }]);
    expect([got.low, got.high]).toEqual([0, 0]);
    expect(got.rateDiff).toBeUndefined();
    expect(got.real).toBeUndefined();
  });

  it("opens the axis below zero for a loss", () => {
    const got = summaryFigures({
      ...year,
      return_bp: -300,
      result: brl(-3000),
    });

    expect([got.low, got.high]).toEqual([-300, 1050]);
  });

  it("writes a gain in success, a loss in danger and zero in the text colour", () => {
    expect([signTone(1), signTone(-1), signTone(0)]).toEqual([
      "success",
      "danger",
      "default",
    ]);
  });
});
