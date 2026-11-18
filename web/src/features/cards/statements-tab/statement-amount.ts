import type { components } from "@/api/schema.gen";

type StatementSummary = components["schemas"]["StatementSummary"];

// A138: an open statement shows the institution's open bill, without the previous statement
// not yet due; every other statement shows its amount due.
export function statementAmount(
  s: Pick<StatementSummary, "status" | "amount_due" | "open_amount">,
): StatementSummary["amount_due"] {
  return s.status === "open" ? s.open_amount : s.amount_due;
}

// An open statement has no payment after closing: its unpaid amount is its open amount, so a
// statement after the current one does not repeat the bills before it.
export function statementUnpaid(
  s: Pick<StatementSummary, "status" | "unpaid" | "open_amount">,
): StatementSummary["unpaid"] {
  return s.status === "open" ? s.open_amount : s.unpaid;
}
