import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  filterPickerEntries,
  memberKey,
  pickerEntries,
} from "@/features/portfolio/contribution-plan/editor/picker-entries";

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
  owned: false,
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

describe("filterPickerEntries", () => {
  const entries = {
    accounts: [
      account("a1", { name: "Poupança Itaú", currency: "BRL" }),
      account("a2", { name: "Reserva", currency: "EUR" }),
    ],
    instruments: [
      { ...instrument("PETR4", "stock"), name: "Petrobras PN" },
      { ...instrument("BTC", "crypto"), name: "Bitcoin" },
    ],
  };

  const cases: {
    name: string;
    query: string;
    ids: string[];
    codes: string[];
  }[] = [
    {
      name: "keeps all for a blank query",
      query: "  ",
      ids: ["a1", "a2"],
      codes: ["PETR4", "BTC"],
    },
    {
      name: "matches a name ignoring case and accents",
      query: "POUPANCA",
      ids: ["a1"],
      codes: [],
    },
    {
      name: "matches an instrument code",
      query: "petr",
      ids: [],
      codes: ["PETR4"],
    },
    {
      name: "matches the currency of an account",
      query: "eur",
      ids: ["a2"],
      codes: [],
    },
    {
      name: "matches an instrument name",
      query: "bitco",
      ids: [],
      codes: ["BTC"],
    },
    { name: "matches nothing", query: "zzz", ids: [], codes: [] },
  ];

  it.each(cases)("$name", ({ query, ids, codes }) => {
    const found = filterPickerEntries(entries, query);

    expect(found.accounts.map((a) => a.id)).toEqual(ids);
    expect(found.instruments.map((i) => i.code)).toEqual(codes);
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
