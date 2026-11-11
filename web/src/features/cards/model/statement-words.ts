import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type Statement = components["schemas"]["StatementSummary"];

export const statementStatusWords: Record<Statement["status"], MessageKey> = {
  open: "statement.status.open",
  closed: "statement.status.closed",
  paid: "statement.status.paid",
  partially_paid: "statement.status.partially_paid",
  overdue: "statement.status.overdue",
  financed: "statement.status.financed",
};

export const statementStatusTone = {
  open: "accent",
  closed: "warning",
  paid: "success",
  partially_paid: "warning",
  overdue: "danger",
  financed: "secondary",
} as const;
