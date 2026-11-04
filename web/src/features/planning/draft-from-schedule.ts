import type { components } from "@/api/schema.gen";
import {
  emptyDraft,
  type ScheduleDraft,
} from "@/features/planning/schedule-draft";
import { currentTerms } from "@/features/planning/schedule-words";

type Schedule = components["schemas"]["Schedule"];

// The draft of a schedule that continues another one from `start`: every field is copied except
// the account, which is the one the reader changes. The count is dropped (it would restart the
// occurrences); the end date is kept.
export function draftFromSchedule(
  source: Schedule,
  nextExpected: string | null,
  today: string,
): ScheduleDraft {
  const start = nextExpected ?? today;
  const terms = currentTerms(source.terms, start);
  const base = emptyDraft(today);
  const recurrence = terms?.recurrence ?? base.recurrence;

  return {
    kind: source.kind,
    accountID: null,
    counterpartID: source.counterpart_id,
    payeeID: source.payee_id ?? null,
    description: source.description,
    amount: terms?.amount.amount ?? 0,
    recurrence: omitCount({ ...recurrence, start }),
    calendar: source.calendar,
    toleranceBP: source.match_tolerance_bp,
    graceDays: source.grace_days,
  };
}

function omitCount(
  recurrence: ScheduleDraft["recurrence"],
): ScheduleDraft["recurrence"] {
  const copy = { ...recurrence };
  delete copy.count;

  return copy;
}
