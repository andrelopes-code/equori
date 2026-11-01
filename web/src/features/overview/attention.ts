import type { components } from "@/api/schema.gen";
import { budgetState } from "@/features/planning";
import type { Figures } from "@/features/planning";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];
type Money = components["schemas"]["Money"];
type ConnectionState = components["schemas"]["Connection"]["state"];

// A statement due within this many days, or past due, is noticed.
export const statementNoticeDays = 3;

export interface AttentionItem {
  kind:
    | "uncategorized"
    | "unconfirmed"
    | "connections"
    | "statement_due"
    | "budget_over"
    | "difference";
  count: number;
  account?: Account;
  // The open difference of a reconciliation.
  difference?: Money;
  // The account's unconfirmed entries, on its difference item (A133).
  unconfirmed?: number;
  // The card statement of the account's earliest unconfirmed entry.
  statementId?: string;
  // The unpaid statement of a statement_due item.
  statement?: Statement;
  overdue?: boolean;
}

export function attentionItems(input: {
  today: string;
  uncategorized: number;
  unconfirmed: readonly {
    account: Account;
    count: number;
    statementId?: string;
  }[];
  connections: readonly { state: ConnectionState }[];
  differences: readonly { account: Account; difference: Money | undefined }[];
  statements: readonly { account: Account; unpaid: readonly Statement[] }[];
  budgets: readonly { progress: Figures }[];
}): AttentionItem[] {
  const stuck = input.connections.filter((c) => c.state !== "ok").length;
  const open = (d: { difference: Money | undefined }) =>
    d.difference !== undefined && d.difference.amount !== 0;
  const differing = new Set(
    input.differences.filter(open).map((d) => d.account.id),
  );
  const noticeUntil = plusDays(input.today, statementNoticeDays);
  const overBudget = input.budgets.filter(
    (b) => budgetState(b.progress) === "over",
  ).length;
  const count = new Map(input.unconfirmed.map((u) => [u.account.id, u.count]));
  return [
    ...(input.uncategorized > 0
      ? [{ kind: "uncategorized" as const, count: input.uncategorized }]
      : []),
    ...input.unconfirmed
      .filter((u) => u.count > 0 && !differing.has(u.account.id))
      .map((u) => ({
        kind: "unconfirmed" as const,
        count: u.count,
        account: u.account,
        ...(u.statementId === undefined ? {} : { statementId: u.statementId }),
      })),
    ...(stuck > 0 ? [{ kind: "connections" as const, count: stuck }] : []),
    ...input.statements.flatMap((s) =>
      s.unpaid
        .filter((statement) => statement.due_date <= noticeUntil)
        .map((statement) => ({
          kind: "statement_due" as const,
          count: 1,
          account: s.account,
          statement,
          overdue: statement.due_date < input.today,
        })),
    ),
    ...(overBudget > 0
      ? [{ kind: "budget_over" as const, count: overBudget }]
      : []),
    ...input.differences.flatMap((d) =>
      d.difference === undefined || !open(d)
        ? []
        : [
            {
              kind: "difference" as const,
              count: 1,
              account: d.account,
              difference: d.difference,
              ...((count.get(d.account.id) ?? 0) > 0
                ? { unconfirmed: count.get(d.account.id) ?? 0 }
                : {}),
            },
          ],
    ),
  ];
}

function plusDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
