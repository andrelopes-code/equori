import type { components } from "@/api/schema.gen";
import {
  paidShare,
  statementDue,
} from "@/features/cards/card-tile/statement-due";

type Statement = components["schemas"]["StatementSummary"];

export type LeadWord = "overdue" | "soon" | "partial" | "due" | "open";

export interface StatementLeadResult {
  statement: Statement;
  kind: "closed" | "open";
  word: LeadWord;
  status: "danger" | "warning" | "info" | "neutral";
  // To the due date (closed) or to the closing date (open); negative once past.
  days: number;
}

const dayMs = 86_400_000;

// The cycle bar draws the closing at 55 and the due date at 92; 97 is past due.
const closingAt = 55;
const dueAt = 92;
const pastDueAt = 97;

// The statement the ticket leads with: the oldest closed statement still owing, else the open one.
export function statementLead(
  current: Statement | undefined,
  unpaid: readonly Statement[],
  today: string,
): StatementLeadResult | undefined {
  const [oldest] = unpaid;

  if (oldest) {
    const { days, status } = statementDue(oldest.due_date, today);

    return {
      statement: oldest,
      kind: "closed",
      word: closedWord(status, paidShare(unpaid).paid > 0),
      status,
      days,
    };
  }

  if (current) {
    return {
      statement: current,
      kind: "open",
      word: "open",
      status: "neutral",
      days: daysBetween(today, current.closing_date),
    };
  }

  return undefined;
}

// Where today sits in the cycle of a statement, from 0 to 97 (spec 4.8): the cycle starts one
// calendar month before the closing, the closing sits at 55 and the due date at 92.
export function cyclePosition(
  closing: string,
  due: string,
  today: string,
): number {
  if (today > due) {
    return pastDueAt;
  }

  if (today >= closing) {
    const span = daysBetween(closing, due);

    if (span === 0) {
      return dueAt;
    }

    return (
      closingAt + ((dueAt - closingAt) * daysBetween(closing, today)) / span
    );
  }

  const start = monthBefore(closing);
  const elapsed = Math.max(daysBetween(start, today), 0);

  return (closingAt * elapsed) / daysBetween(start, closing);
}

function closedWord(
  status: "danger" | "warning" | "info",
  partlyPaid: boolean,
): LeadWord {
  if (status === "danger") {
    return "overdue";
  }

  if (status === "warning") {
    return "soon";
  }

  return partlyPaid ? "partial" : "due";
}

// The same day of the previous month, or its last day when that month is shorter.
function monthBefore(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, month - 2, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs,
  );
}
