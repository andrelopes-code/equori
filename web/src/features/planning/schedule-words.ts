import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type OccurrenceState = components["schemas"]["OccurrenceState"];

export const kindLabel: Record<
  components["schemas"]["ScheduleKind"],
  MessageKey
> = {
  bill: "scheduled.kind.bill",
  income: "scheduled.kind.income",
  subscription: "scheduled.kind.subscription",
  transfer: "scheduled.kind.transfer",
  savings: "scheduled.kind.savings",
};

export const stateTone: Record<
  OccurrenceState,
  "info" | "danger" | "success" | "secondary"
> = {
  expected: "info",
  overdue: "danger",
  realized: "success",
  skipped: "secondary",
};
