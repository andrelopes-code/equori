import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import type { BalanceGroup } from "@/features/accounts/balance-sheet/balance-groups";
import { sheetRows } from "@/features/accounts/balance-sheet/balance-sheet";

type Account = components["schemas"]["Account"];

describe("sheetRows", () => {
  it("adds to a subtree only the children in the parent's currency", () => {
    const group: BalanceGroup = {
      group: "reserves",
      total: { amount: 0, currency: "BRL" },
      excluded: 0,
      items: [
        item("p", undefined, "BRL", 1000),
        item("a", "p", "BRL", 250),
        item("b", "p", "USD", 700),
      ],
    };

    const rows = sheetRows(group, "en-US");

    expect(
      rows.map((r) => [r.account.id, r.depth, r.hasChildren, r.subtree]),
    ).toEqual([
      ["p", 0, true, { amount: 1250, currency: "BRL" }],
      ["a", 1, false, { amount: 250, currency: "BRL" }],
      ["b", 1, false, { amount: 700, currency: "USD" }],
    ]);
  });

  // Valued balance sheet design VB3 (A260).
  it("adds the value of a child in another currency to the parent", () => {
    const position = {
      ...item("b", "p", "PETR4", 10),
      value: { amount: 3500, currency: "BRL" },
    };
    const group: BalanceGroup = {
      group: "reserves",
      total: { amount: 0, currency: "BRL" },
      excluded: 0,
      items: [item("p", undefined, "BRL", 1000), position],
    };

    const rows = sheetRows(group, "en-US", { base: "BRL" });

    expect(rows.map((r) => [r.account.id, r.subtree, r.position])).toEqual([
      ["p", { amount: 4500, currency: "BRL" }, false],
      ["b", { amount: 10, currency: "PETR4" }, true],
    ]);
  });
});

function item(
  id: string,
  parentID: string | undefined,
  currency: string,
  amount: number,
): BalanceGroup["items"][number] {
  const account: Account = {
    id,
    name: id,
    class: "asset",
    kind: "brokerage",
    currency,
    ...(parentID === undefined ? {} : { parent_id: parentID }),
  };
  return { account, balance: { amount, currency } };
}
