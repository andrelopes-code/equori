import { describe, expect, it } from "vitest";

import {
  ledgerRows,
  runningBalances,
} from "@/features/accounts/running-balance";

const money = (amount: number) => ({ amount, currency: "BRL" });

function tx(
  id: string,
  date: string,
  postings: [string, number, string?][],
  extra = {},
) {
  return {
    id,
    date,
    description: id,
    balancing_currency: "BRL",
    origin: "manual" as const,
    version: 1,
    tags: [],
    links: [],
    postings: postings.map(([account_id, amount, status], i) => ({
      id: `${id}-${String(i)}`,
      account_id,
      amount: money(amount),
      weight: money(amount),
      status: (status ?? "cleared") as "pending" | "cleared" | "reconciled",
    })),
    ...extra,
  };
}

describe("runningBalances", () => {
  it("walks back from the closing balance, newest first", () => {
    const balances = runningBalances(
      [
        { id: "a", amount: -50 },
        { id: "b", amount: 100 },
        { id: "c", amount: 0 },
      ],
      1000,
    );
    expect(Object.fromEntries(balances)).toEqual({ a: 1000, b: 1050, c: 950 });
  });
});

describe("ledgerRows", () => {
  it("sums the account's own postings and names the other side", () => {
    const rows = ledgerRows(
      [
        tx("split", "2026-10-10", [
          ["acc", -12000],
          ["acc", -3000, "reconciled"],
          ["food", 10000],
          ["fun", 5000],
        ]),
      ],
      new Set(["acc"]),
    );
    expect(rows).toEqual([
      {
        id: "split",
        date: "2026-10-10",
        transaction: expect.objectContaining({ id: "split" }) as unknown,
        amount: -15000,
        currency: "BRL",
        status: "cleared",
        counterparts: ["food", "fun"],
        voided: false,
      },
    ]);
  });

  it("leaves a voided transaction out of the balance", () => {
    const [row] = ledgerRows(
      [
        tx(
          "v",
          "2026-10-09",
          [
            ["acc", -500],
            ["food", 500],
          ],
          { voided_at: "2026-10-11T00:00:00Z" },
        ),
      ],
      new Set(["acc"]),
    );
    expect(row?.voided).toBe(true);
    expect(row?.amount).toBe(0);
  });

  it("reads a posting as reconciled only when every posting on the account is", () => {
    const [row] = ledgerRows(
      [
        tx("r", "2026-10-08", [
          ["acc", -500, "reconciled"],
          ["food", 500],
        ]),
      ],
      new Set(["acc"]),
    );
    expect(row?.status).toBe("reconciled");
  });
});
