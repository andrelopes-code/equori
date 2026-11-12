import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  memberKey,
  pickerEntries,
} from "@/features/portfolio/contribution-plan/picker-entries";

type Account = components["schemas"]["Account"];
type Instrument = components["schemas"]["Instrument"];

const account = (id: string, change: Partial<Account> = {}): Account => ({
  id,
  name: id,
  class: "asset",
  kind: "savings",
  currency: "BRL",
  ...change,
});

const instrument = (code: string, type: Instrument["type"]): Instrument => ({
  code,
  type,
  scale: 2,
  name: code,
});

const instruments = [
  instrument("BRL", "currency"),
  instrument("PETR4", "stock"),
];

describe("pickerEntries", () => {
  const cases: { name: string; accounts: Account[]; ids: string[] }[] = [
    { name: "keeps a savings account", accounts: [account("a")], ids: ["a"] },
    {
      name: "keeps reserve and brokerage kinds",
      accounts: [
        account("r", { kind: "reserve" }),
        account("b", { kind: "brokerage" }),
      ],
      ids: ["r", "b"],
    },
    {
      name: "drops a kind without a balance",
      accounts: [
        account("c", { kind: "checking" }),
        { id: "n", name: "n", class: "asset", currency: "BRL" },
      ],
      ids: [],
    },
    {
      name: "drops a liability",
      accounts: [account("l", { class: "liability" })],
      ids: [],
    },
    {
      name: "drops an account with children",
      accounts: [account("p"), account("c", { parent_id: "p" })],
      ids: ["c"],
    },
    {
      name: "drops a closed account",
      accounts: [account("x", { closed_on: "2026-01-01" })],
      ids: [],
    },
    {
      name: "drops an account in a currency the catalog lacks",
      accounts: [account("u", { currency: "USD" })],
      ids: [],
    },
  ];

  it.each(cases)("$name", ({ accounts, ids }) => {
    expect(
      pickerEntries(accounts, instruments).accounts.map((a) => a.id),
    ).toEqual(ids);
  });

  it("lists every instrument that is not a currency", () => {
    expect(
      pickerEntries([], instruments).instruments.map((i) => i.code),
    ).toEqual(["PETR4"]);
  });
});

describe("memberKey", () => {
  it.each([
    [{ accountId: "a1" }, "account:a1"],
    [{ instrument: "PETR4" }, "instrument:PETR4"],
    [{ accountId: "a1", instrument: "PETR4" }, "account:a1"],
    [{}, "instrument:"],
  ])("keys %j as %s", (ref, key) => {
    expect(memberKey(ref)).toBe(key);
  });
});
