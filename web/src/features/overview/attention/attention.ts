import type { components } from "@/api/schema.gen";
import { budgetState } from "@/features/planning";
import type { Figures } from "@/features/planning";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];
type Money = components["schemas"]["Money"];
type FixedIncomeEvent = components["schemas"]["FixedIncomeEvent"];
type ConnectionState = components["schemas"]["Connection"]["state"];

// A statement due within this many days, or past due, is noticed.
export const statementNoticeDays = 3;

// Upcoming fixed income payments within this many days are counted in one item (FC19).
export const fixedIncomeWeekDays = 7;

// A budget over its amount by up to this share of its room is of the lowest weight (AT3).
export const budgetMarginPercent = 10;

export type AttentionWeight = "critical" | "high" | "normal" | "low";

export type ReviewSegment =
  | { kind: "uncategorized"; count: number }
  | {
      kind: "account";
      account: Account;
      count: number;
      // The card statement of the account's earliest unconfirmed entry.
      statementId?: string;
    };

export type AttentionItem =
  | {
      kind: "statement";
      weight: "critical" | "high";
      account: Account;
      statement: Statement;
      // Days past the due date when critical, days left when high.
      days: number;
    }
  | { kind: "connections"; weight: "high"; count: number }
  | {
      kind: "budget";
      weight: "normal" | "low";
      id: string;
      name: string;
      // Percent of the room, rounded; 100 when the budget has no room.
      share: number;
      overrun: Money;
      room: Money;
      spent: Money;
    }
  | {
      kind: "review";
      weight: "normal";
      total: number;
      // The uncategorized count is a lower bound.
      more: boolean;
      segments: ReviewSegment[];
    }
  | {
      kind: "difference";
      weight: "normal";
      account: Account;
      difference: Money;
      // The account's unconfirmed entries, on its difference item (A133).
      unconfirmed?: number;
    }
  | {
      kind: "fixed_income_due";
      weight: "high" | "normal";
      event: FixedIncomeEvent;
    }
  | {
      kind: "fixed_income_week";
      weight: "low";
      count: number;
      // The sum of the gross of the events; events whose rate is missing add nothing.
      total: Money;
    };

interface AttentionInput {
  today: string;
  uncategorized: number;
  uncategorizedMore?: boolean;
  unconfirmed: readonly {
    account: Account;
    count: number;
    statementId?: string;
  }[];
  connections: readonly { state: ConnectionState }[];
  differences: readonly { account: Account; difference: Money | undefined }[];
  statements: readonly { account: Account; unpaid: readonly Statement[] }[];
  budgets: readonly { id: string; name: string; progress: Figures }[];
  fixedIncome?: readonly FixedIncomeEvent[];
}

export type StatementItem = Extract<AttentionItem, { kind: "statement" }>;
export type BudgetItem = Extract<AttentionItem, { kind: "budget" }>;
export type ReviewItem = Extract<AttentionItem, { kind: "review" }>;
export type DifferenceItem = Extract<AttentionItem, { kind: "difference" }>;
export type FixedIncomeDueItem = Extract<
  AttentionItem,
  { kind: "fixed_income_due" }
>;
export type FixedIncomeWeekItem = Extract<
  AttentionItem,
  { kind: "fixed_income_week" }
>;

// Items come ranked: by weight, then by kind (AT2).
export function attentionItems(input: AttentionInput): AttentionItem[] {
  const budgets = budgetItems(input.budgets);
  const due = fixedIncomeDueItems(input.fixedIncome ?? []);

  return [
    ...statementItems(input),
    ...connectionItems(input.connections),
    ...due.filter((d) => d.weight === "high"),
    ...budgets.filter((b) => b.weight === "normal"),
    ...due.filter((d) => d.weight === "normal"),
    ...reviewItems(input),
    ...differenceItems(input),
    ...budgets.filter((b) => b.weight === "low"),
    ...fixedIncomeWeekItems(input),
  ];
}

// The count of the header leaves out the items of the lowest weight (AT5).
export function attentionCount(items: readonly AttentionItem[]): number {
  return items.filter((item) => item.weight !== "low").length;
}

function statementItems(input: AttentionInput): AttentionItem[] {
  const noticeUntil = shiftDay(input.today, statementNoticeDays);

  return input.statements
    .flatMap((s) =>
      s.unpaid
        .filter((statement) => statement.due_date <= noticeUntil)
        .map((statement) => ({ account: s.account, statement })),
    )
    .sort(
      (a, b) =>
        a.statement.due_date.localeCompare(b.statement.due_date) ||
        a.statement.id.localeCompare(b.statement.id),
    )
    .map(({ account, statement }) => {
      const late = statement.due_date < input.today;

      return {
        kind: "statement" as const,
        weight: late ? ("critical" as const) : ("high" as const),
        account,
        statement,
        days: late
          ? daysBetween(statement.due_date, input.today)
          : daysBetween(input.today, statement.due_date),
      };
    });
}

function connectionItems(
  connections: AttentionInput["connections"],
): AttentionItem[] {
  const stuck = connections.filter((c) => c.state !== "ok").length;

  return stuck > 0
    ? [{ kind: "connections", weight: "high", count: stuck }]
    : [];
}

function fixedIncomeDueItems(
  events: readonly FixedIncomeEvent[],
): FixedIncomeDueItem[] {
  return events
    .filter((event) => event.state === "due")
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.instrument.localeCompare(b.instrument),
    )
    .map((event) => ({
      kind: "fixed_income_due" as const,
      weight:
        event.kind === "maturity" ? ("high" as const) : ("normal" as const),
      event,
    }));
}

function fixedIncomeWeekItems(input: AttentionInput): AttentionItem[] {
  const until = shiftDay(input.today, fixedIncomeWeekDays);
  const week = (input.fixedIncome ?? []).filter(
    (event) =>
      event.state === "upcoming" &&
      event.date >= input.today &&
      event.date <= until,
  );
  const currency = week.find((e) => e.gross !== undefined)?.gross?.currency;
  if (week.length === 0 || currency === undefined) return [];

  return [
    {
      kind: "fixed_income_week",
      weight: "low",
      count: week.length,
      total: {
        amount: week.reduce((sum, e) => sum + (e.gross?.amount ?? 0), 0),
        currency,
      },
    },
  ];
}

function budgetItems(budgets: AttentionInput["budgets"]): BudgetItem[] {
  return budgets
    .filter((b) => budgetState(b.progress) === "over")
    .map((b) => {
      const { planned, carried, spent, available } = b.progress;
      const room = planned.amount + carried.amount;
      const overrun = -available.amount;
      const share = room <= 0 ? 100 : Math.round((overrun * 100) / room);

      return {
        kind: "budget" as const,
        weight:
          share <= budgetMarginPercent ? ("low" as const) : ("normal" as const),
        id: b.id,
        name: b.name,
        share,
        overrun: { ...available, amount: overrun },
        room: { ...planned, amount: room },
        spent,
      };
    })
    .sort((a, b) => b.share - a.share || a.id.localeCompare(b.id));
}

function reviewItems(input: AttentionInput): AttentionItem[] {
  const differing = differingAccounts(input.differences);
  const segments: ReviewSegment[] = [
    ...(input.uncategorized > 0
      ? [{ kind: "uncategorized" as const, count: input.uncategorized }]
      : []),
    ...input.unconfirmed
      .filter((u) => u.count > 0 && !differing.has(u.account.id))
      .map((u) => ({
        kind: "account" as const,
        account: u.account,
        count: u.count,
        ...(u.statementId === undefined ? {} : { statementId: u.statementId }),
      })),
  ].sort((a, b) => b.count - a.count);
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return total === 0
    ? []
    : [
        {
          kind: "review",
          weight: "normal",
          total,
          more: input.uncategorizedMore === true,
          segments,
        },
      ];
}

function differenceItems(input: AttentionInput): AttentionItem[] {
  const count = new Map(input.unconfirmed.map((u) => [u.account.id, u.count]));

  return input.differences.flatMap((d) => {
    if (d.difference === undefined || d.difference.amount === 0) return [];
    const unconfirmed = count.get(d.account.id) ?? 0;

    return [
      {
        kind: "difference" as const,
        weight: "normal" as const,
        account: d.account,
        difference: d.difference,
        ...(unconfirmed > 0 ? { unconfirmed } : {}),
      },
    ];
  });
}

function differingAccounts(
  differences: AttentionInput["differences"],
): Set<string> {
  return new Set(
    differences
      .filter((d) => d.difference !== undefined && d.difference.amount !== 0)
      .map((d) => d.account.id),
  );
}

function daysBetween(from: string, to: string): number {
  const day = 24 * 60 * 60 * 1000;

  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / day,
  );
}

export function shiftDay(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);

  return date.toISOString().slice(0, 10);
}
