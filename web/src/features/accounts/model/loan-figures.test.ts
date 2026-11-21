import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  loanFigures,
  remainingInstallments,
} from "@/features/accounts/model/loan-figures";

type Schedule = components["schemas"]["Schedule"];
type Transaction = components["schemas"]["Transaction"];

describe("loanFigures", () => {
  it("derives financed, outstanding, repaid and interest (K5, K6)", () => {
    const borrow = tx([
      ["car", 6190000],
      ["checking", -3402254],
      ["loan", -2787746],
    ]);
    const first = tx([
      ["checking", -88863],
      ["loan", 36174],
      ["interest", 52689],
    ]);
    const second = tx([
      ["checking", -88863],
      ["loan", 36858],
      ["interest", 52005],
    ]);

    // Balance after two installments: −2 787 746 + 36 174 + 36 858.
    const got = loanFigures(
      "loan",
      -2714714,
      [second, first, borrow],
      new Set(["interest"]),
    );

    expect(got).toEqual({
      financed: 2787746,
      outstanding: 2714714,
      repaid: 73032,
      fraction: 73032 / 2787746,
      interest: 104694,
      payments: 2,
    });
  });

  it("has no fraction when nothing was financed", () => {
    expect(loanFigures("loan", 0, [], new Set()).fraction).toBeUndefined();
  });
});

describe("remainingInstallments", () => {
  it("counts the monthly occurrences after today and before ends_on (K7)", () => {
    // 48 installments on the 15th from 2025-09-15; ends_on 2029-08-16 holds the last one.
    const got = remainingInstallments(
      "loan",
      [other(), schedule("2025-09-15", 15, "2029-08-16")],
      "2026-11-21",
    );

    // 2026-12-15 to 2029-08-15: 1 + 12 + 12 + 8.
    expect(got).toEqual({
      count: 33,
      last: "2029-08-15",
      amount: { amount: 88863, currency: "BRL" },
    });
  });

  it("holds the day to the month's last day", () => {
    const got = remainingInstallments(
      "loan",
      [schedule("2027-01-31", 31, "2027-03-01")],
      "2027-01-31",
    );

    expect(got?.last).toBe("2027-02-28");
    expect(got?.count).toBe(1);
  });

  it("draws nothing without an end, for another frequency or when paid off", () => {
    const open = { ...schedule("2025-09-15", 15, "2029-08-16") };
    delete open.ends_on;
    const weekly = schedule("2025-09-15", 15, "2029-08-16", "weekly");

    expect(remainingInstallments("loan", [open], "2026-11-21")).toBeUndefined();
    expect(
      remainingInstallments("loan", [weekly], "2026-11-21"),
    ).toBeUndefined();
    expect(
      remainingInstallments(
        "loan",
        [schedule("2025-09-15", 15, "2029-08-16")],
        "2029-08-15",
      ),
    ).toBeUndefined();
  });
});

function schedule(
  start: string,
  day: number,
  endsOn: string,
  frequency = "monthly",
): Schedule {
  return {
    id: "s",
    kind: "transfer",
    account_id: "checking",
    counterpart_id: "loan",
    description: "",
    ends_on: endsOn,
    pauses: [],
    terms: [
      {
        effective_from: start,
        amount: { amount: 88863, currency: "BRL" },
        recurrence: {
          frequency,
          interval: 1,
          day_of_month: day,
          start,
          adjustment: "none",
        },
      },
    ],
  } as unknown as Schedule;
}

function other(): Schedule {
  const s = schedule("2024-11-01", 5, "2030-01-01");
  s.counterpart_id = "salary";

  return s;
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
