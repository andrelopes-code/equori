import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  consequenceOf,
  unavailableOf,
} from "@/features/transactions/account-field/account-consequence";
import type {
  Consequence,
  ConsequenceInput,
  Unavailable,
} from "@/features/transactions/account-field/account-consequence";
import type { Operation } from "@/features/transactions/account-field/account-operation";

type Account = components["schemas"]["Account"];
type Placement = components["schemas"]["StatementPlacement"];

const checking = account("checking");
const savings = account("savings");
const loan = account("loan");
const card = account("credit_card", {
  card: {
    credit_limit: { amount: 500000, currency: "BRL" },
    available_limit: { amount: 15000, currency: "BRL" },
  },
});
const usd = account("checking", { currency: "USD" });

const placementOf = (
  dueDate: string,
  previousClosing: string,
  previousDue: string,
): Placement => ({
  reference: "2026-12",
  closing_date: "2026-12-03",
  due_date: dueDate,
  previous_closing_date: previousClosing,
  previous_due_date: previousDue,
});
const openStatement = placementOf("2026-12-10", "2026-10-03", "2026-10-10");
const closedStatement = placementOf("2026-12-17", "2026-11-10", "2026-11-17");

const base: Omit<ConsequenceInput, "account" | "operation"> = {
  amount: 28640,
  currency: "BRL",
  date: "2026-11-12",
  balance: undefined,
  placement: undefined,
};

describe("consequenceOf", () => {
  it.each<[string, ConsequenceInput, Consequence | null]>([
    [
      "ordinary expense",
      { ...base, account: checking, operation: "expense", balance: 100000 },
      null,
    ],
    [
      "overdraw",
      { ...base, account: checking, operation: "expense", balance: 1989 },
      { kind: "overdraw", after: -26651 },
    ],
    [
      "reserve out",
      { ...base, account: savings, operation: "expense", balance: 3597198 },
      { kind: "reserve", after: 3568558 },
    ],
    [
      "transfer from reserve",
      {
        ...base,
        account: savings,
        operation: "transfer-out",
        balance: 100000,
        amount: 50000,
      },
      { kind: "reserve", after: 50000 },
    ],
    [
      "income",
      {
        ...base,
        account: checking,
        operation: "income",
        balance: 1989,
        amount: 450000,
      },
      null,
    ],
    [
      "transfer destination",
      {
        ...base,
        account: checking,
        operation: "transfer-in",
        balance: 1989,
        amount: 150000,
      },
      null,
    ],
    [
      "no amount",
      {
        ...base,
        account: checking,
        operation: "expense",
        balance: 1989,
        amount: 0,
      },
      null,
    ],
    [
      "unknown balance",
      { ...base, account: checking, operation: "expense" },
      null,
    ],
    [
      "liability",
      { ...base, account: loan, operation: "expense", balance: 0 },
      null,
    ],
    [
      "card purchase",
      {
        ...base,
        account: card,
        operation: "expense",
        placement: openStatement,
      },
      { kind: "statement", dueDate: "2026-12-10", closedOn: null },
    ],
    [
      "card after closing",
      {
        ...base,
        account: card,
        operation: "expense",
        placement: closedStatement,
      },
      { kind: "statement", dueDate: "2026-12-17", closedOn: "2026-11-10" },
    ],
    [
      "card paid by transfer",
      {
        ...base,
        account: card,
        operation: "transfer-in",
        placement: openStatement,
      },
      { kind: "settles", dueDate: "2026-12-10" },
    ],
    [
      "card income",
      {
        ...base,
        account: card,
        operation: "income",
        placement: openStatement,
      },
      null,
    ],
    [
      "card without placement",
      { ...base, account: card, operation: "expense" },
      null,
    ],
    [
      "other currency",
      { ...base, account: usd, operation: "expense", balance: 1000 },
      null,
    ],
  ])("%s", (_, input, want) => {
    expect(consequenceOf(input)).toEqual(want);
  });
});

describe("unavailableOf", () => {
  it.each<[string, Account, number, Operation, string, Unavailable | null]>([
    [
      "free limit below the amount",
      card,
      28640,
      "expense",
      "BRL",
      { reason: "noFreeLimit", missing: 13640 },
    ],
    ["free limit equal to the amount", card, 15000, "expense", "BRL", null],
    ["no amount", card, 0, "expense", "BRL", null],
    [
      "transfer source",
      card,
      28640,
      "transfer-out",
      "BRL",
      { reason: "noFreeLimit", missing: 13640 },
    ],
    ["money coming in", card, 28640, "transfer-in", "BRL", null],
    ["income", card, 28640, "income", "BRL", null],
    ["not a card", checking, 28640, "expense", "BRL", null],
    ["other currency", card, 28640, "expense", "USD", null],
  ])("%s", (_, a, amount, operation, currency, want) => {
    expect(unavailableOf(a, amount, operation, currency)).toEqual(want);
  });
});

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
