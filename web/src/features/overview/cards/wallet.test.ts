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

describe("the cycle of a card", () => {
  it("runs from the closing before the open statement to its due date", () => {
    const view = walletView(cards, today, "BRL");
    const cycles = view.cards.map((card) => [card.account.id, card.cycle]);

    // Nubank: 10/11 to 17/12 is 37 days; today is day 7 (18.9%), the closing day 30 (81.1%).
    // Itaú and Ultra have no statement before the open one: the rail starts a month before
    // the closing. Wise: 28/10 to 05/12 is 38 days; today is day 20, the closing day 31.
    expect(cycles).toEqual([
      [
        "ultra",
        cycle("2026-10-28", "2026-11-28", "2026-12-05", 11, 20, 52.6, 81.6),
      ],
      [
        "wise",
        cycle("2026-10-28", "2026-11-28", "2026-12-05", 11, 20, 52.6, 81.6),
      ],
      [
        "itau",
        cycle("2026-11-03", "2026-12-03", "2026-12-10", 16, 14, 37.8, 81.1),
      ],
      [
        "nubank",
        cycle("2026-11-10", "2026-12-10", "2026-12-17", 23, 7, 18.9, 81.1),
      ],
    ]);
  });

  it("holds none without an open statement", () => {
    const owing = [{ ...nubankCard, current: undefined }];
    const view = walletView(owing, today, "BRL");

    expect(view.cards[0]?.cycle).toBeUndefined();
  });
});

describe("the history of a card", () => {
  it("draws the closed statements and the open one against the tallest", () => {
    const view = walletView(cards, today, "BRL");
    const nubank = view.cards.find((card) => card.account.id === "nubank");

    // Tallest: 2,918.38. Mean of the closed: (1,250.00 + 2,918.38) / 2 = 2,084.19.
    expect(nubank?.history).toEqual({
      bars: [
        bar("2026-10", 125000, "BRL", false, 42.8),
        bar("2026-11", 291838, "BRL", false, 100),
        bar("2026-12", 56587, "BRL", true, 19.4),
      ],
      mean: { amount: 208419, currency: "BRL" },
      meanHeight: 71.4,
    });
  });

  it("keeps the currency of a card outside the base", () => {
    const view = walletView(cards, today, "BRL");
    const wise = view.cards.find((card) => card.account.id === "wise");

    expect(wise?.history).toEqual({
      bars: [
        bar("2026-10", 15000, "USD", false, 100),
        bar("2026-11", 12000, "USD", true, 80),
      ],
      mean: { amount: 15000, currency: "USD" },
      meanHeight: 100,
    });
  });

  it("draws no bar without a closed statement", () => {
    const view = walletView(cards, today, "BRL");
    const itau = view.cards.find((card) => card.account.id === "itau");

    expect(itau?.history).toEqual({ bars: [], mean: undefined, meanHeight: 0 });
  });

  it("keeps the last twelve closed statements", () => {
    // Fourteen paid statements of 10.00 to 140.00, closing from 2025-09 to 2026-10.
    const paid = Array.from({ length: 14 }, (_, i) => {
      const month = new Date(Date.UTC(2025, 8 + i, 3))
        .toISOString()
        .slice(0, 10);

      return statement(`p${String(i)}`, "paid", month, month, (i + 1) * 1000);
    });
    const many = [
      { ...nubankCard, statements: [...paid, ...nubankCard.statements] },
    ];
    const view = walletView(many, today, "BRL");
    const history = view.cards[0]?.history;

    // Sixteen closed with Nubank's two (2026-10 and 2026-11); the last twelve by reference drop
    // 2025-09 to 2025-12 and start at 2026-01.
    expect(history?.bars.filter((b) => !b.open)).toHaveLength(12);
    expect(history?.bars[0]?.reference).toBe("2026-01");
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
    reference: closing.slice(0, 7),
    unpaid: { amount, currency },
    open_amount: { amount, currency },
    billed_amount: { amount, currency },
  } as Statement;
}

function cycle(
  start: string,
  closes: string,
  due: string,
  left: number,
  gone: number,
  today: number,
  close: number,
) {
  return { start, closes, due, left, gone, today, close };
}

function bar(
  reference: string,
  amount: number,
  currency: string,
  open: boolean,
  height: number,
) {
  return { reference, amount: { amount, currency }, open, height };
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

const itauOpen = statement(
  "itau-open",
  "open",
  "2026-12-10",
  "2026-12-03",
  69240,
);
const nubankOpen = statement(
  "nubank-open",
  "open",
  "2026-12-17",
  "2026-12-10",
  56587,
);
const wisePaid = statement(
  "wise-paid",
  "paid",
  "2026-11-05",
  "2026-10-28",
  15000,
  "USD",
);
const wiseOpen = statement(
  "wise-open",
  "open",
  "2026-12-05",
  "2026-11-28",
  12000,
  "USD",
);
const ultraOpen = statement(
  "ultra-open",
  "open",
  "2026-12-05",
  "2026-11-28",
  8990,
);
const idleOpen = statement("idle-open", "open", "2026-12-05", "2026-11-28", 0);

const nubankCard = {
  account: account("nubank", "BRL", [1400000, 0]),
  current: nubankOpen,
  unpaid: [late, closed],
  statements: [late, closed, nubankOpen],
};

const cards = [
  {
    account: account("itau", "BRL", [2400000, 2330760]),
    current: itauOpen,
    unpaid: [],
    statements: [itauOpen],
  },
  nubankCard,
  {
    account: account("wise", "USD", [200000, 188000]),
    current: wiseOpen,
    unpaid: [],
    statements: [wisePaid, wiseOpen],
  },
  {
    account: account("ultra", "BRL"),
    current: ultraOpen,
    unpaid: [],
    statements: [ultraOpen],
  },
  {
    account: account("idle", "BRL", [100000, 100000]),
    current: idleOpen,
    unpaid: [],
    statements: [idleOpen],
  },
];
