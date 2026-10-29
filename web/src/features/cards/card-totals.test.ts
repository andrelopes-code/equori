import { describe, expect, it } from "vitest";

import {
  cardTotals,
  currentAndUnpaid,
  limitMeter,
  owedAmount,
} from "@/features/cards/card-totals";
import {
  accountFixtures,
  cardID,
  statementFixtures,
} from "@/testing/account-api";

const card = accountFixtures.find((a) => a.id === cardID) as never;

describe("currentAndUnpaid", () => {
  it("takes the open statement and the closed ones still owing", () => {
    const { current, unpaid } = currentAndUnpaid(statementFixtures as never);
    expect(current?.reference).toBe("2026-11");
    expect(unpaid.map((s) => s.reference)).toEqual(["2026-10"]);
  });
});

describe("cardTotals", () => {
  it("adds the open statements, what is due with its nearest date, and the free limit", () => {
    const { current, unpaid } = currentAndUnpaid(statementFixtures as never);
    const totals = cardTotals(
      [
        { account: card, current, unpaid },
        { account: card, current, unpaid: [] },
      ],
      "BRL",
    );
    expect(totals).toEqual({
      open: { amount: 500000, currency: "BRL" },
      due: { amount: 180000, currency: "BRL" },
      nearestDue: "2026-10-25",
      available: { amount: 1100000, currency: "BRL" },
      limit: { amount: 1600000, currency: "BRL" },
    });
  });
});

describe("cardTotals overdue", () => {
  it("dates the oldest statement past its due date", () => {
    const statements = statementFixtures.map((s) =>
      s.reference === "2026-10" ? { ...s, status: "overdue" } : s,
    );
    const { current, unpaid } = currentAndUnpaid(statements as never);

    const totals = cardTotals([{ account: card, current, unpaid }], "BRL");

    expect(totals.overdueSince).toBe("2026-10-25");
  });

  it("dates nothing when no statement is overdue", () => {
    const { current, unpaid } = currentAndUnpaid(statementFixtures as never);

    const totals = cardTotals([{ account: card, current, unpaid }], "BRL");

    expect(totals.overdueSince).toBeUndefined();
  });
});

describe("owedAmount", () => {
  it("adds what each closed statement still owes", () => {
    const unpaid = [
      { unpaid: { amount: 120000, currency: "BRL" } },
      { unpaid: { amount: 60000, currency: "BRL" } },
    ] as never;

    expect(owedAmount(unpaid)).toBe(180000);
  });
});

describe("limitMeter", () => {
  it("takes the used share of the credit limit", () => {
    const meter = limitMeter({
      credit_limit: { amount: 800000, currency: "BRL" },
      available_limit: { amount: 550000, currency: "BRL" },
    });

    expect(meter).toEqual({ used: 250000, total: 800000 });
  });

  it("uses 0 when the available limit exceeds the credit limit", () => {
    const meter = limitMeter({
      credit_limit: { amount: 100000, currency: "BRL" },
      available_limit: { amount: 150000, currency: "BRL" },
    });

    expect(meter).toEqual({ used: 0, total: 100000 });
  });

  it("returns undefined without a credit limit", () => {
    expect(limitMeter(undefined)).toBeUndefined();
  });
});
