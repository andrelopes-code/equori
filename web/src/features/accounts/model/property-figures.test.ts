import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  acquisition,
  financingLoans,
  valueChange,
} from "@/features/accounts/model/property-figures";

type Transaction = components["schemas"]["Transaction"];

describe("acquisition", () => {
  it("takes the first non-zero point of the series (K1)", () => {
    const points = [
      point("2025-08-14", 0),
      point("2025-08-15", 6190000),
      point("2025-08-16", 6190000),
    ];

    expect(acquisition(points)).toEqual({
      date: "2025-08-15",
      value: 6190000,
    });
  });

  it("is undefined while every point is zero", () => {
    expect(acquisition([point("2025-08-15", 0)])).toBeUndefined();
  });
});

describe("valueChange", () => {
  it("writes the change and its fraction of the acquisition (K2)", () => {
    // 57 400,00 against 61 900,00: −4 500,00, −4500/61900.
    expect(valueChange(5740000, 6190000)).toEqual({
      amount: -450000,
      fraction: -450000 / 6190000,
    });
  });

  it("leaves the fraction out when the acquisition was zero", () => {
    expect(valueChange(1000, 0)).toEqual({ amount: 1000, fraction: undefined });
  });
});

describe("financingLoans", () => {
  it("finds the loan credited in the purchase of the property (K3)", () => {
    const purchase = tx([
      ["car", 6190000],
      ["checking", -3590000],
      ["loan", -2787746],
      ["other-loan", 100],
    ]);
    const revaluation = tx([
      ["car", -130000],
      ["adjustments", 130000],
    ]);

    const got = financingLoans(
      "car",
      [revaluation, purchase],
      new Set(["loan", "other-loan"]),
    );

    expect(got).toEqual(["loan"]);
  });

  it("ignores a loan that took money out of the property", () => {
    const sale = tx([
      ["car", -6190000],
      ["loan", -100],
    ]);

    expect(financingLoans("car", [sale], new Set(["loan"]))).toEqual([]);
  });
});

function point(date: string, amount: number) {
  return { date, balance: { amount, currency: "BRL" } };
}

function tx(postings: [string, number][]): Transaction {
  return {
    id: "t",
    date: "2025-08-15",
    description: "",
    balancing_currency: "BRL",
    version: 1,
    origin: "manual",
    tags: [],
    links: [],
    postings: postings.map(([account, amount], i) => ({
      id: String(i),
      account_id: account,
      amount: { amount, currency: "BRL" },
      weight: { amount, currency: "BRL" },
      status: "cleared" as const,
    })),
  } as unknown as Transaction;
}
