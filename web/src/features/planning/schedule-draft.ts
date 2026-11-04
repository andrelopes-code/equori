import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

export type ScheduleKind = components["schemas"]["ScheduleKind"];
export type Recurrence = components["schemas"]["Recurrence"];
type ScheduleInput = components["schemas"]["ScheduleInput"];

// The server's defaults (ScheduleInput), shown so the reader sees what is sent.
const defaultToleranceBP = 1000;
const defaultGraceDays = 3;
const defaultWindowDays = 7;

export interface ScheduleDraft {
  kind: ScheduleKind;
  accountID: string | null;
  counterpartID: string | null;
  payeeID: string | null;
  description: string;
  amount: number;
  recurrence: Recurrence;
  // Null until the reader picks one; the server then applies the calendar of the region.
  calendar: string | null;
  toleranceBP: number;
  graceDays: number;
  windowDays: number;
}

export interface ScheduleInputContext {
  currency: string;
  defaultCalendar: string | undefined;
}

export function emptyDraft(today: string): ScheduleDraft {
  return {
    kind: "bill",
    accountID: null,
    counterpartID: null,
    payeeID: null,
    description: "",
    amount: 0,
    recurrence: {
      frequency: "monthly",
      interval: 1,
      day_of_month: Number(today.slice(8, 10)),
      adjustment: "none",
      start: today,
    },
    calendar: null,
    toleranceBP: defaultToleranceBP,
    graceDays: defaultGraceDays,
    windowDays: defaultWindowDays,
  };
}

// A schedule's counterpart: a category for a bill, a subscription or an income, another balance
// account for a transfer or a saving.
export function takesCategory(kind: ScheduleKind): boolean {
  return kind === "bill" || kind === "subscription" || kind === "income";
}

export function draftProblems(
  draft: ScheduleDraft,
): Partial<
  Record<"description" | "amount" | "account_id" | "counterpart_id", MessageKey>
> {
  return {
    ...(draft.description.trim() === ""
      ? { description: "schedule.required.description" as const }
      : {}),
    ...(draft.amount <= 0
      ? { amount: "schedule.required.amount" as const }
      : {}),
    ...(draft.accountID === null
      ? { account_id: "schedule.required.account" as const }
      : {}),
    ...(draft.counterpartID === null
      ? { counterpart_id: "schedule.required.counterpart" as const }
      : {}),
  };
}

export function scheduleInput(
  draft: ScheduleDraft,
  ctx: ScheduleInputContext,
): ScheduleInput | null {
  if (draft.accountID === null || draft.counterpartID === null) return null;

  const calendar = draft.calendar ?? ctx.defaultCalendar ?? "";
  const sendsCalendar = calendar !== "" && calendar !== ctx.defaultCalendar;

  return {
    kind: draft.kind,
    account_id: draft.accountID,
    counterpart_id: draft.counterpartID,
    ...(draft.payeeID === null || !takesCategory(draft.kind)
      ? {}
      : { payee_id: draft.payeeID }),
    description: draft.description.trim(),
    amount: { amount: draft.amount, currency: ctx.currency },
    recurrence: draft.recurrence,
    ...(sendsCalendar ? { calendar } : {}),
    match_tolerance_bp: draft.toleranceBP,
    grace_days: draft.graceDays,
    match_window_days: draft.windowDays,
  };
}
