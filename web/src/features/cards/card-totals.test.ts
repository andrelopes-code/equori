import { describe, expect, it } from "vitest";

import { cardTotals, currentAndUnpaid } from "@/features/cards/card-totals";
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
