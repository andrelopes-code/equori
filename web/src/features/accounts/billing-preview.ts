import type { components } from "@/api/schema.gen";

type BillingCycleRule = components["schemas"]["BillingCycleRule"];

export interface StatementEstimate {
  reference: string;
  closing: string;
  due: string;
}

interface Month {
  year: number;
  month: number;
}

function addMonths(m: Month, n: number): Month {
  const index = m.year * 12 + (m.month - 1) + n;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function iso(m: Month, day: number): string {
  // T02: a day past the month's end is its last day. Day 0 of the next month is that day.
  const last = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  return `${String(m.year)}-${String(m.month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function datesFor(
  m: Month,
  rule: BillingCycleRule,
): { closing: string; due: string } {
  const due = iso(m, rule.due_day);
  if (rule.closing_mode === "before_due") {
    return { closing: shift(due, -(rule.closing_days_before_due ?? 0)), due };
  }
  const closingDay = rule.closing_day ?? 1;
  const closingMonth = closingDay >= rule.due_day ? addMonths(m, -1) : m;
  return { closing: iso(closingMonth, closingDay), due };
}

// A port of DatesFor and StatementFor (internal/ledger/internal/domain/billing.go) for one rule,
// without the calendar shifts: an estimate the form shows before the rule is stored. The
// reference month is the month of the due date (A1).
export function billingPreview(
  rule: BillingCycleRule,
  purchase: string,
): StatementEstimate {
  const start = addMonths(
    { year: Number(purchase.slice(0, 4)), month: Number(purchase.slice(5, 7)) },
    -1,
  );
  const assignClosing = rule.closing_day_assignment === "closing";
  for (let i = 0; ; i += 1) {
    const m = addMonths(start, i);
    const { closing, due } = datesFor(m, rule);
    if (purchase < closing || (assignClosing && purchase === closing)) {
      return { reference: iso(m, 1).slice(0, 7), closing, due };
    }
  }
}
