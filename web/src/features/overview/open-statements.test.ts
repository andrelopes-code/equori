import { describe, expect, it } from "vitest";

import { owedStatements } from "@/features/overview/open-statements";

const money = (amount: number) => ({ amount, currency: "BRL" });
const statement = (
  id: string,
  status: string,
  due_date: string,
  amount_due: number,
  unpaid: number,
  open_amount = amount_due,
) =>
  ({
    id,
    status,
    due_date,
    amount_due: money(amount_due),
    unpaid: money(unpaid),
    open_amount: money(open_amount),
  }) as never;
const account = (id: string) => ({ id, name: id }) as never;

describe("owedStatements", () => {
  // S180 (A138): the closed statement not yet due is owed on its own row; the open one owes
  // only its own cycle, not the card balance that carries the closed one.
  it("owes the open statement's open amount beside the unpaid closed one", () => {
    const rows = owedStatements([
      {
        account: account("nubank"),
        current: statement("dec", "open", "2026-12-07", 159237, 159237, 35372),
        unpaid: [statement("nov", "closed", "2026-11-05", 123865, 123865)],
      },
    ]);

    expect(rows.map((r) => [r.statement.id, r.amount.amount])).toEqual([
      ["nov", 123865],
      ["dec", 35372],
    ]);
  });

  it("lists the open statement with charges and the unpaid closed ones, by due date", () => {
    const rows = owedStatements([
      {
        account: account("visa"),
        current: statement("nov", "open", "2026-11-12", 250000, 250000),
        unpaid: [
          statement("oct", "closed", "2026-10-25", 180000, 180000),
          statement("sep", "overdue", "2026-09-25", 50000, 20000),
        ],
      },
      {
        account: account("master"),
        current: statement("empty", "open", "2026-11-10", 0, 0),
        unpaid: [],
      },
    ]);
    expect(rows.map((r) => [r.statement.id, r.amount.amount, r.open])).toEqual([
      ["sep", 20000, false],
      ["oct", 180000, false],
      ["nov", 250000, true],
    ]);
  });
});
