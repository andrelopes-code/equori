import { describe, expect, it } from "vitest";

import {
  brokerageCashAccounts,
  buildHoldings,
  holdingGroups,
  holdingsSummary,
  orderedByGroup,
  staleSince,
} from "@/features/portfolio/portfolio-holdings";

const brl = (amount: number) => ({ amount, currency: "BRL" });

const accounts = [
  {
    id: "xp",
    name: "XP",
    class: "asset",
    kind: "brokerage",
    currency: "BRL",
    institution_id: "i-xp",
  },
  {
    id: "xp-cash",
    name: "XP cash",
    class: "asset",
    kind: "brokerage",
    currency: "BRL",
    parent_id: "xp",
  },
  {
    id: "xp-petr",
    name: "xp PETR4",
    class: "asset",
    kind: "brokerage",
    currency: "PETR4",
    parent_id: "xp",
  },
  {
    id: "xp-cdb",
    name: "xp CDB",
    class: "asset",
    kind: "brokerage",
    currency: "CDB",
    parent_id: "xp",
  },
  {
    id: "bank",
    name: "Bank",
    class: "asset",
    kind: "checking",
    currency: "BRL",
  },
  {
    id: "solo",
    name: "Solo",
    class: "asset",
    kind: "brokerage",
    currency: "USD",
  },
  {
    id: "gone",
    name: "Gone",
    class: "asset",
    kind: "brokerage",
    currency: "BRL",
    closed_on: "2020-01-01",
  },
] as never[];

const instruments = [
  { code: "BRL", type: "currency", name: "Real", scale: 2 },
  { code: "USD", type: "currency", name: "Dollar", scale: 2 },
  {
    code: "PETR4",
    type: "stock",
    name: "Petrobras PN",
    scale: 0,
    quote_currency: "BRL",
  },
  {
    code: "CDB",
    type: "fixed_income",
    name: "CDB XP",
    scale: 2,
    quote_currency: "BRL",
  },
  {
    code: "AAPL",
    type: "stock",
    name: "Apple",
    scale: 0,
    quote_currency: "USD",
  },
] as never[];

const positions = [
  {
    account_id: "xp-petr",
    instrument: "PETR4",
    quantity: { amount: 10, currency: "PETR4" },
    cost_basis: brl(1000),
    market_value: brl(1500),
  },
  {
    account_id: "xp-cdb",
    instrument: "CDB",
    quantity: { amount: 100, currency: "CDB" },
    cost_basis: brl(2000),
    market_value: brl(1600),
  },
  {
    account_id: "xp-cdb",
    instrument: "AAPL",
    quantity: { amount: 1, currency: "AAPL" },
    cost_basis: { amount: 50, currency: "USD" },
    market_value: brl(400),
  },
  {
    account_id: "xp-petr",
    instrument: "CDB",
    quantity: { amount: 1, currency: "CDB" },
    cost_basis: brl(70),
  },
] as never[];

const cash = [
  { accountID: "xp-cash", balance: brl(500) },
  { accountID: "solo" },
];

const holdings = () =>
  buildHoldings({ positions, accounts, instruments, cash });

describe("brokerageCashAccounts", () => {
  it("takes the childless currency accounts of a brokerage tree that are open at the date", () => {
    const ids = brokerageCashAccounts(accounts, instruments, "2026-01-01").map(
      (a) => (a as unknown as { id: string }).id,
    );

    expect(ids).toEqual(["xp-cash", "solo"]);
  });

  it("reads a child of a brokerage as brokerage cash without a kind of its own", () => {
    const tree = [
      { id: "p", class: "asset", kind: "brokerage", currency: "BRL" },
      { id: "c", class: "asset", currency: "BRL", parent_id: "p" },
    ] as never[];

    const ids = brokerageCashAccounts(tree, instruments, "2026-01-01").map(
      (a) => (a as unknown as { id: string }).id,
    );

    expect(ids).toEqual(["c"]);
  });
});

describe("buildHoldings", () => {
  it("gives every valued row a share of one total, largest first", () => {
    expect(holdings().map((h) => [h.code, h.value, h.share])).toEqual([
      ["CDB", 1600, 4000],
      ["PETR4", 1500, 3750],
      ["BRL", 500, 1250],
      ["AAPL", 400, 1000],
      ["CDB", undefined, undefined],
      ["USD", undefined, undefined],
    ]);
  });

  it("states the gain only where cost and value share a currency", () => {
    const byKey = new Map(holdings().map((h) => [h.key, h]));

    expect(byKey.get("xp-petr-PETR4")).toMatchObject({
      gain: 500,
      gainBp: 5000,
      mixed: false,
    });
    expect(byKey.get("xp-cdb-CDB")).toMatchObject({
      gain: -400,
      gainBp: -2000,
    });
    expect(byKey.get("xp-cdb-AAPL")).toMatchObject({
      gain: undefined,
      mixed: true,
    });
    expect(byKey.get("xp-petr-CDB")).toMatchObject({
      gain: undefined,
      mixed: false,
    });
  });

  it("names a position by its instrument and reads the institution of its tree", () => {
    const petr = holdings().find((h) => h.code === "PETR4");

    expect(petr).toMatchObject({
      name: "Petrobras PN",
      type: "stock",
      currency: "BRL",
      institutionID: "i-xp",
      kind: "position",
    });
  });

  it("makes cash a row of its own type and currency", () => {
    const row = holdings().find((h) => h.key === "cash-xp-cash");

    expect(row).toMatchObject({
      kind: "cash",
      name: "XP cash",
      code: "BRL",
      type: "cash",
      currency: "BRL",
      institutionID: "i-xp",
    });
  });

  it("leaves a zero balance out", () => {
    const rows = buildHoldings({
      positions: [],
      accounts,
      instruments,
      cash: [{ accountID: "xp-cash", balance: brl(0) }],
    });

    expect(rows).toEqual([]);
  });

  it("keeps a position whose instrument the catalog does not hold", () => {
    const rows = buildHoldings({
      positions: [
        {
          account_id: "xp-petr",
          instrument: "XYZ",
          quantity: { amount: 1, currency: "XYZ" },
          cost_basis: brl(1),
          market_value: brl(1),
        },
      ] as never[],
      accounts,
      instruments,
      cash: [],
    });

    expect(rows[0]).toMatchObject({ name: "XYZ", type: "", currency: "BRL" });
  });
});

describe("holdingGroups", () => {
  it("sums the rows of a type, largest first, with the shares of its rows", () => {
    expect(holdingGroups(holdings(), "type")).toEqual([
      { key: "stock", value: 1900, share: 4750 },
      { key: "fixed_income", value: 1600, share: 4000 },
      { key: "cash", value: 500, share: 1250 },
    ]);
  });

  it("groups by the currency and by the institution", () => {
    expect(holdingGroups(holdings(), "currency").map((g) => g.key)).toEqual([
      "BRL",
      "USD",
    ]);
    expect(holdingGroups(holdings(), "institution").map((g) => g.key)).toEqual([
      "i-xp",
    ]);
  });
});

describe("orderedByGroup", () => {
  it("places the largest group first and the largest row first inside it", () => {
    const rows = orderedByGroup(holdings(), "type").map((h) => h.key);

    expect(rows).toEqual([
      "xp-petr-PETR4",
      "xp-cdb-AAPL",
      "xp-cdb-CDB",
      "xp-petr-CDB",
      "cash-xp-cash",
      "cash-solo",
    ]);
  });
});

describe("holdingsSummary", () => {
  it("adds the parts and measures the gain on the comparable positions", () => {
    expect(holdingsSummary(holdings())).toEqual({
      total: 4000,
      positions: 3500,
      cash: 500,
      cost: 3000,
      gain: 100,
      gainFraction: 100 / 3000,
      unpriced: 2,
      mixed: 1,
    });
  });

  it("has no fraction without a cost", () => {
    expect(holdingsSummary([]).gainFraction).toBeUndefined();
  });
});

describe("staleSince", () => {
  it.each([
    ["a price of the last week", [{ date: "2026-11-01" }], undefined],
    ["a price of exactly seven days", [{ date: "2026-10-31" }], undefined],
    ["a price of eight days", [{ date: "2026-10-30" }], "2026-10-30"],
    [
      "the oldest of two prices",
      [{ date: "2026-11-06" }, { date: "2026-09-01" }],
      "2026-09-01",
    ],
    ["no price", undefined, undefined],
  ])("%s", (_name, prices, expected) => {
    expect(staleSince(prices, "2026-11-07")).toBe(expected);
  });
});
