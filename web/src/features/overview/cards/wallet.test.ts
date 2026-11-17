import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { deadlineOf, walletView } from "@/features/overview/cards/wallet";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];

describe("walletView", () => {
  it("orders the wallet with the card to pay first at the front", () => {
    const view = walletView(cards, today, "BRL");

    expect(view.cards.map((card) => card.account.id)).toEqual([
      "ultra",
      "wise",
      "itau",
      "nubank",
    ]);
    expect(view.chosen).toBe("nubank");
  });

  it("adds what a card owes and keeps its most urgent deadline", () => {
    const view = walletView(cards, today, "BRL");
    const nubank = view.cards.find((card) => card.account.id === "nubank");
    const itau = view.cards.find((card) => card.account.id === "itau");

    // 1,250.00 overdue since 2026-10-17 and 2,918.38 due today.
    expect(nubank?.owed).toEqual({
      amount: { amount: 416838, currency: "BRL" },
      statement: late,
      deadline: { kind: "overdue", days: -31, date: "2026-10-17" },
    });
    expect(nubank?.open?.id).toBe("nubank-open");
    expect(itau?.owed).toBeUndefined();
  });

  it("states the limit of a card, or none", () => {
    const view = walletView(cards, today, "BRL");
    const limits = view.cards.map((card) => [
      card.account.id,
      card.limit?.percent,
      card.limit?.full,
      card.limit?.used.amount,
    ]);

    // Itaú: 24,000.00 - 23,307.60 = 692.40, 2.885% of the limit.
    expect(limits).toEqual([
      ["ultra", undefined, undefined, undefined],
      ["wise", 6, false, 12000],
      ["itau", 3, false, 69240],
      ["nubank", 100, true, 1400000],
    ]);
  });

  it("totals the base currency and counts what stays out", () => {
    const view = walletView(cards, today, "BRL");

    expect(view.due).toEqual({
      amount: { amount: 416838, currency: "BRL" },
      count: 2,
      deadline: { kind: "overdue", days: -31, date: "2026-10-17" },
    });
    // 565.87 + 692.40 + 89.90; the 120.00 dollars of Wise stay out.
    expect(view.open).toEqual({
      amount: { amount: 134817, currency: "BRL" },
      count: 3,
      foreign: 1,
    });
  });

  it("holds nothing without a card that owes", () => {
    const idle = cards.filter((card) => card.account.id === "idle");
    const view = walletView(idle, today, "BRL");

    expect(view).toEqual({
      cards: [],
      chosen: undefined,
      due: { amount: { amount: 0, currency: "BRL" }, count: 0 },
      open: { amount: { amount: 0, currency: "BRL" }, count: 0, foreign: 0 },
    });
  });
});

describe("deadlineOf", () => {
  it.each([
    ["closed", "2026-11-17", "soon", 0],
    ["closed", "2026-11-20", "soon", 3],
    ["closed", "2026-11-21", "week", 4],
    ["partially_paid", "2026-11-24", "week", 7],
    ["closed", "2026-11-25", "date", 8],
    ["overdue", "2026-11-10", "overdue", -7],
  ] as const)("a %s statement due %s is %s", (status, due, kind, days) => {
    expect(deadlineOf({ status, due_date: due }, today)).toEqual({
      kind,
      days,
      date: due,
    });
  });
});

const today = "2026-11-17";

function account(
  id: string,
  currency: string,
  limit?: [number, number],
): Account {
  return {
    id,
    name: id,
    kind: "credit_card",
    currency,
    ...(limit === undefined
      ? {}
      : {
          card: {
            credit_limit: { amount: limit[0], currency },
            available_limit: { amount: limit[1], currency },
          },
        }),
  } as Account;
}

function statement(
  id: string,
  status: Statement["status"],
  due: string,
  closing: string,
  amount: number,
  currency = "BRL",
): Statement {
  return {
    id,
    status,
    due_date: due,
    closing_date: closing,
    unpaid: { amount, currency },
    open_amount: { amount, currency },
  } as Statement;
}

const late = statement(
  "nubank-late",
  "overdue",
  "2026-10-17",
  "2026-10-10",
  125000,
);
const closed = statement(
  "nubank-closed",
  "closed",
  "2026-11-17",
  "2026-11-10",
  291838,
);

const cards = [
  {
    account: account("itau", "BRL", [2400000, 2330760]),
    current: statement("itau-open", "open", "2026-12-10", "2026-12-03", 69240),
    unpaid: [],
  },
  {
    account: account("nubank", "BRL", [1400000, 0]),
    current: statement(
      "nubank-open",
      "open",
      "2026-12-17",
      "2026-12-10",
      56587,
    ),
    unpaid: [late, closed],
  },
  {
    account: account("wise", "USD", [200000, 188000]),
    current: statement(
      "wise-open",
      "open",
      "2026-12-05",
      "2026-11-28",
      12000,
      "USD",
    ),
    unpaid: [],
  },
  {
    account: account("ultra", "BRL"),
    current: statement("ultra-open", "open", "2026-12-05", "2026-11-28", 8990),
    unpaid: [],
  },
  {
    account: account("idle", "BRL", [100000, 100000]),
    current: statement("idle-open", "open", "2026-12-05", "2026-11-28", 0),
    unpaid: [],
  },
];
