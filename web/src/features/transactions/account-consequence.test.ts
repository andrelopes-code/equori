import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  consequenceOf,
  unavailableReason,
} from "@/features/transactions/account-consequence";
import type { ConsequenceInput } from "@/features/transactions/account-consequence";

type Account = components["schemas"]["Account"];

function account(
  kind: NonNullable<Account["kind"]>,
  extra: Partial<Account> = {},
): Account {
  return {
    id: kind,
    name: kind,
    class:
      kind === "credit_card" || kind === "loan" || kind === "payable"
        ? "liability"
        : "asset",
    kind,
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
    ...extra,
  };
}

const card = (available?: number) =>
  account(
    "credit_card",
    available === undefined
      ? {}
      : {
          card: {
            credit_limit: { amount: 500000, currency: "BRL" },
            available_limit: { amount: available, currency: "BRL" },
          },
        },
  );

const placement = {
  reference: "2026-11",
  closing_date: "2026-10-29",
  due_date: "2026-11-05",
  previous_closing_date: "2026-10-18",
  previous_due_date: "2026-10-25",
};

const base: Omit<ConsequenceInput, "account"> = {
  amount: 28640,
  direction: "out",
  date: "2026-10-15",
  balance: undefined,
  placement: undefined,
};

describe("consequenceOf", () => {
  it.each<[string, ConsequenceInput, ReturnType<typeof consequenceOf>]>([
    [
      "checking: balance minus the expense",
      { ...base, account: account("checking"), balance: 431210 },
      { kind: "balance", after: 402570, warning: false, reserve: false },
    ],
    [
      "checking: a negative balance is a warning",
      { ...base, account: account("checking"), balance: 10000 },
      { kind: "balance", after: -18640, warning: true, reserve: false },
    ],
    [
      "checking: income adds to the balance",
      {
        ...base,
        account: account("checking"),
        balance: 431210,
        direction: "in",
      },
      { kind: "balance", after: 459850, warning: false, reserve: false },
    ],
    [
      "checking: no balance, no consequence",
      { ...base, account: account("checking") },
      null,
    ],
    [
      "reserve: paying from it is a warning",
      { ...base, account: account("reserve"), balance: 695025 },
      { kind: "balance", after: 666385, warning: true, reserve: true },
    ],
    [
      "reserve: money coming in is not a warning",
      {
        ...base,
        account: account("reserve"),
        balance: 695025,
        direction: "in",
      },
      { kind: "balance", after: 723665, warning: false, reserve: false },
    ],
    [
      "loan: a liability has no balance consequence",
      { ...base, account: account("payable"), balance: -100000 },
      null,
    ],
    [
      "card: the statement the purchase is billed on",
      { ...base, account: card(315723), placement },
      { kind: "statement", dueDate: "2026-11-05", closedOn: null },
    ],
    [
      "card: after a closing and before that statement is due",
      { ...base, account: card(), placement, date: "2026-10-20" },
      { kind: "statement", dueDate: "2026-11-05", closedOn: "2026-10-18" },
    ],
    [
      "card: on the previous due date the note still applies",
      { ...base, account: card(), placement, date: "2026-10-25" },
      { kind: "statement", dueDate: "2026-11-05", closedOn: "2026-10-18" },
    ],
    [
      "card: without a placement, the free limit left",
      { ...base, account: card(315723) },
      { kind: "limit", after: 287083 },
    ],
    [
      "card: without placement or limit, no consequence",
      { ...base, account: card() },
      null,
    ],
  ])("%s", (_, input, want) => {
    expect(consequenceOf(input)).toEqual(want);
  });
});

describe("unavailableReason", () => {
  it.each<[string, Account, number, "out" | "in", "noFreeLimit" | null]>([
    ["free limit below the amount", card(20000), 28640, "out", "noFreeLimit"],
    ["free limit equal to the amount", card(28640), 28640, "out", null],
    ["money coming in", card(0), 28640, "in", null],
    ["no limit recorded", card(), 28640, "out", null],
    ["not a card", account("checking"), 28640, "out", null],
  ])("%s", (_, a, amount, direction, want) => {
    expect(unavailableReason(a, amount, direction)).toBe(want);
  });
});
