import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { returnMoney } from "@/features/portfolio/return-money/return-money";
import { brl } from "@/testing/investment-api";
import { contributionReturn, plainReturn } from "@/testing/portfolio-api";

type ReturnReport = components["schemas"]["ReturnReport"];

describe("returnMoney", () => {
  const cases: {
    name: string;
    report: ReturnReport;
    want: ReturnType<typeof returnMoney>;
  }[] = [
    {
      name: "no flows",
      report: report(plainReturn),
      want: {
        currency: "BRL",
        opening: 100000,
        deposits: 0,
        hasFlows: false,
        gain: 5000,
        closing: 105000,
      },
    },
    {
      name: "a deposit",
      report: report(contributionReturn),
      want: {
        currency: "BRL",
        opening: 100000,
        deposits: 100000,
        hasFlows: true,
        gain: 5000,
        closing: 205000,
      },
    },
    {
      name: "a withdrawal",
      report: report({
        ...plainReturn,
        flows: [{ date: "2026-03-01", amount: brl(-30000) }],
        closing: brl(80000),
      }),
      want: {
        currency: "BRL",
        opening: 100000,
        deposits: -30000,
        hasFlows: true,
        gain: 10000,
        closing: 80000,
      },
    },
    {
      name: "a flow in another currency",
      report: report({
        ...plainReturn,
        flows: [
          { date: "2026-03-01", amount: { amount: 1000, currency: "USD" } },
        ],
      }),
      want: undefined,
    },
    {
      name: "a closing in another currency",
      report: report({
        ...plainReturn,
        closing: { amount: 105000, currency: "USD" },
      }),
      want: undefined,
    },
  ];

  it.each(cases)("$name", ({ report, want }) => {
    expect(returnMoney(report)).toEqual(want);
  });
});

function report(base: Omit<ReturnReport, "profile">): ReturnReport {
  return { profile: "rate", ...base };
}
