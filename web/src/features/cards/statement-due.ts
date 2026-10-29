import type { components } from "@/api/schema.gen";

type Statement = components["schemas"]["StatementSummary"];

const dayMs = 86_400_000;

// The last days before the due date, the due day included, that draw a warning.
const soonDays = 3;

// Days from today to the due date, negative once it has passed, and the status the statement
// stub draws: past due is danger, the last soonDays days a warning, any earlier day info.
export function statementDue(
  dueDate: string,
  today: string,
): { days: number; status: "danger" | "warning" | "info" } {
  const days = Math.round(
    (Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      dayMs,
  );

  if (days < 0) {
    return { days, status: "danger" };
  }

  return { days, status: days <= soonDays ? "warning" : "info" };
}

// What the closed statements asked for and how much of it was paid, in minor units.
export function paidShare(unpaid: readonly Statement[]): {
  paid: number;
  total: number;
} {
  return unpaid.reduce(
    (sum, s) => ({
      paid: sum.paid + Math.max(s.amount_due.amount - s.unpaid.amount, 0),
      total: sum.total + s.amount_due.amount,
    }),
    { paid: 0, total: 0 },
  );
}
