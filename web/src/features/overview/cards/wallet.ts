import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];
type Money = components["schemas"]["Money"];

const millisecondsPerDay = 86_400_000;

// A statement due within these days is "soon"; within the week it keeps the relative words (CW8).
const soonDays = 3;
const weekDays = 7;

export interface Deadline {
  kind: "overdue" | "soon" | "week" | "date";
  // Calendar days from today to the due date; negative when past.
  days: number;
  date: string;
}

export interface WalletLimit {
  available: Money;
  used: Money;
  total: Money;
  // The share of the limit in use, rounded; 100 or more is a limit reached (CW9).
  percent: number;
  full: boolean;
}

export interface WalletCard {
  account: Account;
  // What the closed statements of the card still owe, and the most urgent of them.
  owed: { amount: Money; statement: Statement; deadline: Deadline } | undefined;
  // The open statement, when it holds an amount.
  open: Statement | undefined;
  limit: WalletLimit | undefined;
}

export interface WalletView {
  // In wallet order: the card to pay first comes last and starts chosen (CW4).
  cards: WalletCard[];
  chosen: string | undefined;
  due: { amount: Money; count: number; deadline?: Deadline };
  open: { amount: Money; count: number; foreign: number };
}

interface CardStatements {
  account: Account;
  current: Statement | undefined;
  unpaid: readonly Statement[];
}

// The wallet of the Cards widget (docs/specs/2026-11-17-overview-cards-design.md). It holds no
// text.
export function walletView(
  cards: readonly CardStatements[],
  today: string,
  base: string,
): WalletView {
  const owing = cards
    .map((card) => cardOf(card, today))
    .filter((card) => card.owed !== undefined || card.open !== undefined)
    .sort((a, b) => urgency(a).localeCompare(urgency(b)));
  const [first, ...rest] = owing;

  return {
    cards: first === undefined ? [] : [...rest, first],
    chosen: first?.account.id,
    due: dueTotal(cards, today, base),
    open: openTotal(owing, base),
  };
}

// An overdue statement first, then the days left (CW8).
export function deadlineOf(
  statement: Pick<Statement, "status" | "due_date">,
  today: string,
): Deadline {
  const days = daysBetween(today, statement.due_date);
  const date = statement.due_date;

  if (statement.status === "overdue") return { kind: "overdue", days, date };
  if (days <= soonDays) return { kind: "soon", days, date };
  if (days <= weekDays) return { kind: "week", days, date };

  return { kind: "date", days, date };
}

function cardOf(card: CardStatements, today: string): WalletCard {
  const urgent = mostUrgent(card.unpaid);
  const open =
    card.current !== undefined && card.current.open_amount.amount > 0
      ? card.current
      : undefined;

  return {
    account: card.account,
    owed:
      urgent === undefined
        ? undefined
        : {
            amount: {
              amount: card.unpaid.reduce((sum, s) => sum + s.unpaid.amount, 0),
              currency: urgent.unpaid.currency,
            },
            statement: urgent,
            deadline: deadlineOf(urgent, today),
          },
    open,
    limit: limitOf(card.account),
  };
}

function mostUrgent(unpaid: readonly Statement[]): Statement | undefined {
  const byDue = [...unpaid].sort((a, b) =>
    a.due_date.localeCompare(b.due_date),
  );

  return byDue.find((s) => s.status === "overdue") ?? byDue[0];
}

function limitOf(account: Account): WalletLimit | undefined {
  const total = account.card?.credit_limit;
  const available = account.card?.available_limit;

  if (total === undefined || available === undefined) return undefined;

  const used = total.amount - available.amount;
  const percent =
    total.amount > 0 ? Math.round((used * 100) / total.amount) : 100;

  return {
    available,
    used: { amount: used, currency: total.currency },
    total,
    percent,
    full: percent >= 100,
  };
}

// The key of the wallet order: cards that owe by their oldest due date, then the others by the
// due date of their open statement; the account id settles a tie (CW4).
function urgency(card: WalletCard): string {
  const group = card.owed === undefined ? "1" : "0";
  const date = card.owed?.statement.due_date ?? card.open?.due_date ?? "";

  return `${group}/${date}/${card.account.id}`;
}

function dueTotal(
  cards: readonly CardStatements[],
  today: string,
  base: string,
): WalletView["due"] {
  const closed = cards
    .flatMap((card) => card.unpaid)
    .filter((s) => s.unpaid.currency === base);
  const urgent = mostUrgent(closed);

  return {
    amount: {
      amount: closed.reduce((sum, s) => sum + s.unpaid.amount, 0),
      currency: base,
    },
    count: closed.length,
    ...(urgent === undefined ? {} : { deadline: deadlineOf(urgent, today) }),
  };
}

function openTotal(
  cards: readonly WalletCard[],
  base: string,
): WalletView["open"] {
  const open = cards.flatMap((card) =>
    card.open === undefined ? [] : [card.open],
  );
  const inBase = open.filter((s) => s.open_amount.currency === base);

  return {
    amount: {
      amount: inBase.reduce((sum, s) => sum + s.open_amount.amount, 0),
      currency: base,
    },
    count: inBase.length,
    foreign: open.length - inBase.length,
  };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / millisecondsPerDay);
}
