import { describe, expect, it } from "vitest";

import { forecastEntries } from "@/features/reports/forecast-entries";

const categories = new Map([
  ["food", { name: "Food", kind: "expense" as const }],
  ["pay", { name: "Salary", kind: "income" as const }],
]);

describe("forecast entries", () => {
  it("reads the variable entries in the base currency, each with its series", () => {
    const got = forecastEntries(
      [
        tx("t1", "2026-10-02", "Store 1/3", undefined, [
          ["food", 3000, "BRL"],
          ["card", -3000, "BRL"],
        ]),
        tx("t2", "2026-10-05", "Pay", "employer", [
          ["pay", -500000, "BRL"],
          ["checking", 500000, "BRL"],
        ]),
        tx("t3", "2026-10-06", "Rent", undefined, [
          ["food", 200000, "BRL"],
          ["checking", -200000, "BRL"],
        ]),
        tx("t4", "2026-10-07", "Trip", undefined, [["food", 900, "USD"]]),
        tx("t5", "2026-10-08", "Move", undefined, [
          ["savings", 1000, "BRL"],
          ["checking", -1000, "BRL"],
        ]),
        {
          ...tx("t6", "2026-10-09", "Gone", undefined, [["food", 50, "BRL"]]),
          voided_at: "x",
        },
      ],
      categories,
      "BRL",
      new Set(["t3"]),
    );

    expect(got).toEqual([
      {
        date: "2026-10-02",
        kind: "expense",
        amount: -3000,
        category: "food",
        series: "food|d:store",
        label: "Food",
      },
      {
        date: "2026-10-05",
        kind: "income",
        amount: 500000,
        category: "pay",
        series: "pay|p:employer",
        label: "Salary",
      },
    ]);
  });
});

function tx(
  id: string,
  date: string,
  description: string,
  payee: string | undefined,
  postings: [string, number, string][],
) {
  return {
    id,
    date,
    description,
    ...(payee === undefined ? {} : { payee_id: payee }),
    postings: postings.map(([account_id, amount, currency]) => ({
      account_id,
      amount: { amount, currency },
    })),
  };
}
