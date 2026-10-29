import { describe, expect, it } from "vitest";

import { statementAmount } from "@/features/cards/statement-amount";

const due = { amount: 159237, currency: "BRL" };
const open = { amount: 35372, currency: "BRL" };

describe("statementAmount", () => {
  it.each([
    ["S180 open statement", "open", open],
    ["closed statement", "closed", due],
    ["overdue statement", "overdue", due],
  ] as const)("%s", (_name, status, want) => {
    expect(
      statementAmount({ status, amount_due: due, open_amount: open }),
    ).toEqual(want);
  });
});
