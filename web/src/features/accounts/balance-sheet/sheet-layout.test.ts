import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { groupBalances } from "@/features/accounts/balance-sheet/balance-groups";
import {
  arrangeSheet,
  type Order,
} from "@/features/accounts/balance-sheet/sheet-layout";

type Account = components["schemas"]["Account"];
type Balance = components["schemas"]["Balance"];

const institutions = new Map([
  ["inst-a", { name: "Alpha Bank" }],
  ["inst-b", { name: "Beta Bank" }],
]);

describe("arrangeSheet by type", () => {
  it("keeps the groups of the balance sheet with their share of the assets", () => {
    const sections = arrange("kind", "balance");

    expect(
      sections.map((s) => [s.key, s.total.amount, s.share, s.shareOf]),
    ).toEqual([
      ["available", 105000, 105000 / 405000, "assets"],
      ["reserves", 300000, 300000 / 405000, "assets"],
      ["cards", -20000, 20000 / 405000, "assets"],
    ]);
  });

  it("gives no share when the assets are not above zero", () => {
    const sections = arrangeSheet({
      groups: groupBalances(
        [account("card", "credit_card")],
        [balance("card", -500)],
        "BRL",
      ),
      by: "kind",
      order: "balance",
      locale: "en-US",
      base: "BRL",
      institutions,
      differing: new Set(),
    });

    expect(sections.map((s) => [s.key, s.share])).toEqual([
      ["cards", undefined],
    ]);
  });
});

describe("arrangeSheet by institution", () => {
  it("adds up each institution's own balances and shares the net worth", () => {
    const sections = arrange("institution", "balance");

    expect(
      sections.map((s) => [s.key, s.total.amount, s.share, s.shareOf]),
    ).toEqual([
      ["inst-b", 300000, 300000 / 385000, "net"],
      ["inst-a", 80000, 80000 / 385000, "net"],
      ["none", 5000, 5000 / 385000, "net"],
    ]);
  });

  it("keeps the accounts without an institution last under every order", () => {
    for (const order of ["balance", "name", "attention"] as const) {
      const keys = arrange("institution", order).map((s) => s.key);

      expect(keys.at(-1)).toBe("none");
    }
  });

  it("sorts the groups by institution name", () => {
    expect(arrange("institution", "name").map((s) => s.key)).toEqual([
      "inst-a",
      "inst-b",
      "none",
    ]);
  });

  it("puts the group with an open difference first", () => {
    const keys = arrange("institution", "attention", new Set(["child-2"])).map(
      (s) => s.key,
    );

    expect(keys).toEqual(["inst-a", "inst-b", "none"]);
  });

  it("counts an account in another currency in the note and in no total", () => {
    const sections = arrangeSheet({
      groups: groupBalances(
        [
          account("cash", "cash", "BRL", { institution_id: "inst-a" }),
          account("stock", "brokerage", "ITUB4", { institution_id: "inst-a" }),
        ],
        [balance("cash", 1000), balance("stock", 227, "ITUB4")],
        "BRL",
      ),
      by: "institution",
      order: "balance",
      locale: "en-US",
      base: "BRL",
      institutions,
      differing: new Set(),
    });

    expect(sections.map((s) => [s.total.amount, s.excluded])).toEqual([
      [1000, 1],
    ]);
  });
});

describe("arrangeSheet with no group", () => {
  it("lists every account flat, leaving out a parent with a zero balance", () => {
    const sections = arrangeSheet({
      groups: groupBalances(
        [
          account("bank", "checking"),
          account("bank-checking", "checking", "BRL", { parent_id: "bank" }),
          account("bank-savings", "savings", "BRL", { parent_id: "bank" }),
          account("wallet", "wallet"),
        ],
        [
          balance("bank", 0),
          balance("bank-checking", 1200),
          balance("bank-savings", 800),
          balance("wallet", 50),
        ],
        "BRL",
      ),
      by: "none",
      order: "balance",
      locale: "en-US",
      base: "BRL",
      institutions,
      differing: new Set(),
    });

    expect(sections.map((s) => [s.key, s.total.amount, s.share])).toEqual([
      ["all", 2050, undefined],
    ]);
    expect(
      sections[0]?.rows.map((r) => [r.account.id, r.depth, r.hasChildren]),
    ).toEqual([
      ["bank-checking", 0, false],
      ["bank-savings", 0, false],
      ["wallet", 0, false],
    ]);
  });
});

describe("arrangeSheet order of rows", () => {
  it.each<[Order, string[]]>([
    ["name", ["checking", "reserve-a", "reserve-b"]],
    ["balance", ["reserve-b", "reserve-a", "checking"]],
    ["attention", ["reserve-b", "reserve-a", "checking"]],
  ])("sorts the roots of a group by %s", (order, want) => {
    const sections = arrangeSheet({
      groups: groupBalances(
        [
          account("checking", "checking"),
          account("reserve-a", "reserve"),
          account("reserve-b", "reserve"),
        ],
        [
          balance("checking", 10),
          balance("reserve-a", 20),
          balance("reserve-b", 30),
        ],
        "BRL",
      ),
      by: "none",
      order,
      locale: "en-US",
      base: "BRL",
      institutions,
      differing: new Set(["reserve-b"]),
    });

    expect(sections[0]?.rows.map((r) => r.account.id)).toEqual(want);
  });

  it("sorts the children of a parent and puts the positions last", () => {
    const sections = arrangeSheet({
      groups: groupBalances(
        [
          account("broker", "brokerage"),
          account("cash-balance", "brokerage", "BRL", { parent_id: "broker" }),
          account("big", "brokerage", "BRL", { parent_id: "broker" }),
          account("stock-b", "brokerage", "WEGE3", { parent_id: "broker" }),
          account("stock-a", "brokerage", "ITUB4", { parent_id: "broker" }),
        ],
        [
          balance("broker", 0),
          balance("cash-balance", 100),
          balance("big", 900),
          balance("stock-b", 5000, "WEGE3"),
          balance("stock-a", 10, "ITUB4"),
        ],
        "BRL",
      ),
      by: "kind",
      order: "balance",
      locale: "en-US",
      base: "BRL",
      institutions,
      differing: new Set(),
    });

    expect(
      sections[0]?.rows.map((r) => [r.account.id, r.depth, r.position]),
    ).toEqual([
      ["broker", 0, false],
      ["big", 1, false],
      ["cash-balance", 1, false],
      ["stock-a", 1, true],
      ["stock-b", 1, true],
    ]);
  });

  it("puts a parent with a difference under it first", () => {
    const sections = arrangeSheet({
      groups: groupBalances(
        [
          account("big", "checking"),
          account("small", "checking"),
          account("small-child", "checking", "BRL", { parent_id: "small" }),
        ],
        [balance("big", 9000), balance("small", 0), balance("small-child", 10)],
        "BRL",
      ),
      by: "kind",
      order: "attention",
      locale: "en-US",
      base: "BRL",
      institutions,
      differing: new Set(["small-child"]),
    });

    expect(sections[0]?.rows.map((r) => r.account.id)).toEqual([
      "small",
      "small-child",
      "big",
    ]);
  });

  it("counts the children of a parent", () => {
    const sections = arrange("kind", "balance");
    const parent = sections[0]?.rows.find((r) => r.account.id === "parent");

    expect(parent?.childCount).toBe(2);
  });
});

// Two institutions, one account without institution, one parent with two children, a card.
// Net worth 385000; assets 405000.
function arrange(
  by: "kind" | "institution" | "none",
  order: Order,
  differing: ReadonlySet<string> = new Set(),
) {
  return arrangeSheet({
    groups: groupBalances(fixtureAccounts(), fixtureBalances(), "BRL"),
    by,
    order,
    locale: "en-US",
    base: "BRL",
    institutions,
    differing,
  });
}

function fixtureAccounts(): Account[] {
  return [
    account("parent", "checking", "BRL", { institution_id: "inst-a" }),
    account("child-1", "checking", "BRL", {
      institution_id: "inst-a",
      parent_id: "parent",
    }),
    account("child-2", "savings", "BRL", {
      institution_id: "inst-a",
      parent_id: "parent",
    }),
    account("cash", "cash"),
    account("reserve-b", "reserve", "BRL", { institution_id: "inst-b" }),
    account("card-a", "credit_card", "BRL", { institution_id: "inst-a" }),
  ];
}

function fixtureBalances(): Balance[] {
  return [
    balance("parent", 0),
    balance("child-1", 100000),
    balance("child-2", 0),
    balance("cash", 5000),
    balance("reserve-b", 300000),
    balance("card-a", -20000),
  ];
}

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
    date: "2026-11-13",
    basis: "booked",
    balance: { amount, currency },
  };
}
