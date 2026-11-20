import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { groupBalances } from "@/features/accounts/balance-sheet/balance-groups";
import { sides } from "@/features/accounts/balance-sheet/balance-sheet";

type Account = components["schemas"]["Account"];
type Balance = components["schemas"]["Balance"];

function account(
  id: string,
  kind: NonNullable<Account["kind"]>,
  currency = "BRL",
  extra: Partial<Account> = {},
): Account {
  return {
    id,
    name: id,
    class: kind === "credit_card" || kind === "loan" ? "liability" : "asset",
    kind,
    currency,
    ...extra,
  };
}

function balance(accountID: string, amount: number, currency = "BRL"): Balance {
  return {
    account_id: accountID,
    date: "2026-10-17",
    basis: "booked",
    balance: { amount, currency },
  };
}

describe("groupBalances", () => {
  it("totals the base-currency balances of a group", () => {
    const groups = groupBalances(
      [account("checking", "checking"), account("savings", "savings")],
      [balance("checking", 100000), balance("savings", 50000)],
      "BRL",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group).toBe("available");
    expect(groups[0]?.total).toEqual({ amount: 150000, currency: "BRL" });
    expect(groups[0]?.excluded).toBe(0);
    expect(groups[0]?.items.map((i) => i.account.id)).toEqual([
      "checking",
      "savings",
    ]);
  });

  it("keeps a negative card balance in the cards group", () => {
    const groups = groupBalances(
      [account("card", "credit_card")],
      [balance("card", -30000)],
      "BRL",
    );
    expect(groups.map((g) => g.group)).toEqual(["cards"]);
    expect(groups[0]?.total).toEqual({ amount: -30000, currency: "BRL" });
  });

  it("lists foreign balances but excludes them from the total", () => {
    const groups = groupBalances(
      [
        account("checking", "checking"),
        account("savings", "savings"),
        account("usd", "checking", "USD"),
      ],
      [
        balance("checking", 100000),
        balance("savings", 50000),
        balance("usd", 70000, "USD"),
      ],
      "BRL",
    );
    const available = groups[0];
    expect(available?.items).toHaveLength(3);
    expect(available?.total).toEqual({ amount: 150000, currency: "BRL" });
    expect(available?.excluded).toBe(1);
  });

  // Valued balance sheet design VB2 and VB4 (A260).
  it("adds the value of a foreign balance and keeps an unvalued one out", () => {
    const values = new Map([
      ["usd", { amount: 350000, currency: "BRL" }],
      ["petr4", { amount: 30000, currency: "BRL" }],
    ]);

    const groups = groupBalances(
      [
        account("checking", "checking"),
        account("usd", "checking", "USD"),
        account("eur", "checking", "EUR"),
        account("petr4", "checking", "PETR4"),
      ],
      [
        balance("checking", 100000),
        balance("usd", 70000, "USD"),
        balance("eur", 9000, "EUR"),
        balance("petr4", 10, "PETR4"),
      ],
      "BRL",
      false,
      values,
    );

    const available = groups[0];
    expect(available?.total).toEqual({ amount: 480000, currency: "BRL" });
    expect(available?.excluded).toBe(1);
    expect(available?.items.map((i) => i.value)).toEqual([
      undefined,
      { amount: 350000, currency: "BRL" },
      undefined,
      { amount: 30000, currency: "BRL" },
    ]);
  });

  it("assigns reserves and loans and omits closed zero-balance accounts", () => {
    const groups = groupBalances(
      [
        account("broker", "brokerage"),
        account("loan", "loan"),
        account("old", "cash", "BRL", { closed_on: "2026-01-01" }),
        account("kept", "cash", "BRL", { closed_on: "2026-01-01" }),
      ],
      [balance("broker", 900), balance("loan", -5000), balance("kept", 10)],
      "BRL",
    );
    expect(groups.map((g) => g.group)).toEqual([
      "available",
      "reserves",
      "loans",
    ]);
    expect(groups[0]?.items.map((i) => i.account.id)).toEqual(["kept"]);
  });

  // Property account design PA7 (A259).
  it("puts a property in its own group after the reserves, on the asset side", () => {
    const groups = groupBalances(
      [
        account("card", "credit_card"),
        account("home", "property"),
        account("reserve", "reserve"),
      ],
      [
        balance("card", -30000),
        balance("home", 40000000),
        balance("reserve", 5000),
      ],
      "BRL",
    );

    expect(groups.map((g) => g.group)).toEqual([
      "reserves",
      "property",
      "cards",
    ]);
    expect(sides(groups)).toEqual({
      assets: 40005000,
      liabilities: 30000,
      net: 39975000,
    });
  });
});
