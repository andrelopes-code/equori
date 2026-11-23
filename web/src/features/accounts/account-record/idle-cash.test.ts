import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { idleCashCandidate } from "@/features/accounts/account-record/idle-cash";

type Account = components["schemas"]["Account"];
type Instrument = components["schemas"]["Instrument"];

// BC19: the cash account a brokerage can close, and the account that then pays its trades.
describe("idleCashCandidate", () => {
  const cases: {
    name: string;
    accounts: Account[];
    of?: string;
    want: { cash: string; paying: string } | null;
  }[] = [
    {
      name: "one cash, one holding and one account of the institution",
      accounts: [brokerage, cash, holding, checking],
      want: { cash: cashID, paying: checkingID },
    },
    {
      name: "no holding: the cash may wait for its first transfer",
      accounts: [brokerage, cash, checking],
      want: null,
    },
    {
      name: "no account of the institution outside the brokerage",
      accounts: [brokerage, cash, holding],
      want: null,
    },
    {
      name: "two accounts of the institution: the close leaves a choice",
      accounts: [
        brokerage,
        cash,
        holding,
        checking,
        account("savings", { kind: "savings" }),
      ],
      want: null,
    },
    {
      name: "an account of another institution does not pay",
      accounts: [
        brokerage,
        cash,
        holding,
        account(checkingID, { institution_id: other }),
      ],
      want: null,
    },
    {
      name: "a closed account of the institution does not pay",
      accounts: [
        brokerage,
        cash,
        holding,
        account(checkingID, { closed_on: "2026-06-30" }),
      ],
      want: null,
    },
    {
      name: "another brokerage of the institution does not pay",
      accounts: [
        brokerage,
        cash,
        holding,
        account(checkingID, { kind: "brokerage" }),
      ],
      want: null,
    },
    {
      name: "a closed cash is no candidate",
      accounts: [
        brokerage,
        { ...cash, closed_on: "2026-06-30" },
        holding,
        checking,
      ],
      want: null,
    },
    {
      name: "a cash in another currency is not a holding",
      accounts: [
        brokerage,
        cash,
        account("usd", { ...child, currency: "USD" }),
        checking,
      ],
      want: null,
    },
    {
      name: "a brokerage without an institution",
      accounts: [bare, cash, holding, checking],
      want: null,
    },
    {
      name: "the page of the cash itself",
      accounts: [brokerage, cash, holding, checking],
      of: cashID,
      want: null,
    },
    {
      name: "the page of a checking account",
      accounts: [brokerage, cash, holding, checking],
      of: checkingID,
      want: null,
    },
  ];

  it.each(cases)("$name", ({ accounts, of, want }) => {
    const subject = accounts.find((a) => a.id === (of ?? brokerageID));
    if (subject === undefined) throw new Error("subject missing");

    const got = idleCashCandidate(subject, accounts, instruments, "BRL");

    expect(
      got === null ? null : { cash: got.cash.id, paying: got.paying.id },
    ).toEqual(want);
  });
});

const inter = "e0000000-0000-4000-8000-000000000010";
const other = "e0000000-0000-4000-8000-000000000011";
const brokerageID = "e0000000-0000-4000-8000-000000000012";
const cashID = "e0000000-0000-4000-8000-000000000013";
const checkingID = "e0000000-0000-4000-8000-000000000014";

const instruments: Instrument[] = [
  instrument("BRL", "currency"),
  instrument("USD", "currency"),
  instrument("PETR4", "stock"),
];

const child = { kind: "brokerage", parent_id: brokerageID } as const;
const brokerage = account(brokerageID, { kind: "brokerage" });
const cash = account(cashID, child);
const holding = account("petr4", { ...child, currency: "PETR4" });
const checking = account(checkingID, {});
const bare: Account = {
  id: brokerageID,
  name: brokerageID,
  class: "asset",
  kind: "brokerage",
  currency: "BRL",
};

function account(id: string, over: Partial<Account>): Account {
  return {
    id,
    name: id,
    class: "asset",
    kind: "checking",
    currency: "BRL",
    institution_id: inter,
    ...over,
  };
}

function instrument(code: string, type: Instrument["type"]): Instrument {
  return { code, type, scale: 2, name: code, hidden: false, owned: false };
}
