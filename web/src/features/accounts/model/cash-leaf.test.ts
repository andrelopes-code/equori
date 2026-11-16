import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { isCashLeafNamedAfterInstrument } from "@/features/accounts/model/cash-leaf";

type Account = components["schemas"]["Account"];
type Instrument = components["schemas"]["Instrument"];

const instruments: Instrument[] = [
  { owned: false, code: "BRL", type: "currency", scale: 2, name: "Real" },
  { owned: false, code: "AUVP11", type: "fund", scale: 0, name: "AUVP" },
];

function account(over: Partial<Account>): Account {
  return {
    id: "a1",
    name: "AUVP11",
    class: "asset",
    kind: "brokerage",
    currency: "BRL",
    ...over,
  };
}

describe("isCashLeafNamedAfterInstrument", () => {
  const leaf = account({});
  const cases: {
    name: string;
    account: Account;
    accounts: Account[];
    want: boolean;
  }[] = [
    {
      name: "a leaf named after an instrument",
      account: leaf,
      accounts: [leaf],
      want: true,
    },
    {
      name: "a name that is not an instrument code",
      account: account({ name: "Cash" }),
      accounts: [],
      want: false,
    },
    {
      name: "an account with children",
      account: leaf,
      accounts: [leaf, account({ id: "a2", name: "Cash", parent_id: "a1" })],
      want: false,
    },
    {
      name: "a holding in the currency of its instrument",
      account: account({ currency: "AUVP11", parent_id: "a0" }),
      accounts: [],
      want: false,
    },
    {
      name: "another kind",
      account: account({ kind: "checking" }),
      accounts: [],
      want: false,
    },
  ];

  it.each(cases)("returns $want for $name", (c) => {
    expect(
      isCashLeafNamedAfterInstrument(c.account, c.accounts, instruments),
    ).toBe(c.want);
  });
});
