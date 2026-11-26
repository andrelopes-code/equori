import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useChangeTerms, useReviseTerms } from "@/features/planning/api";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Schedule = components["schemas"]["Schedule"];
type ScheduleTerms = components["schemas"]["ScheduleTerms"];

interface TermsDraftOptions {
  schedule: Schedule;
  revised: ScheduleTerms | undefined;
  initialAmount: number;
  initialEffectiveFrom: string | undefined;
  onDone: () => void;
}

// The draft of a terms version: a new one after the latest, or the latest one revised; the
// first version revised keeps its date and its recurrence (A269, TR1, TR2).
export function useTermsDraft({
  schedule,
  revised,
  initialAmount,
  initialEffectiveFrom,
  onDone,
}: TermsDraftOptions) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const change = useChangeTerms();
  const revise = useReviseTerms();

  const latest = schedule.terms.at(-1);
  const first = revised !== undefined && schedule.terms.length === 1;
  const after = draftBound(schedule, revised, today);

  const [from, setFrom] = useState(
    revised?.effective_from ??
      initialEffectiveFrom ??
      firstFreeDate(after, today),
  );
  const [amount, setAmount] = useState(revised?.amount.amount ?? initialAmount);
  const [withRecurrence, setWithRecurrence] = useState(false);
  const [recurrence, setRecurrence] = useState(latest?.recurrence);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const currency = latest?.amount.currency;

  function submit() {
    const next: Record<string, string> = {};
    if (after !== undefined && from <= after)
      next.effective_from = t("schedule.required.after", {
        date: formatDate(after, locale),
      });

    if (revised === undefined && amount === 0 && !withRecurrence)
      next.amount = t("schedule.required.change");

    setErrors(next);
    setSummary(null);
    if (Object.keys(next).length > 0 || currency === undefined) return;

    const terms = {
      effective_from: from,
      ...(amount === 0 ? {} : { amount: { amount, currency } }),
      ...(withRecurrence && recurrence !== undefined ? { recurrence } : {}),
    };
    const request =
      revised === undefined
        ? change.mutateAsync({ id: schedule.id, terms })
        : revise.mutateAsync({
            id: schedule.id,
            effectiveFrom: revised.effective_from,
            terms,
          });
    request.then(onDone).catch((caught: unknown) => {
      setSummary(errorText(caught, t));
    });
  }

  return {
    first,
    after,
    currency,
    from,
    setFrom,
    amount,
    setAmount,
    withRecurrence,
    setWithRecurrence,
    recurrence,
    setRecurrence,
    errors,
    summary,
    pending: change.isPending || revise.isPending,
    submit,
  };
}

// draftBound is the date the effective date must follow: the latest version for a new one, the
// previous version for a revision, none for the first version revised.
function draftBound(
  schedule: Schedule,
  revised: ScheduleTerms | undefined,
  today: string,
): string | undefined {
  if (revised === undefined)
    return schedule.terms.at(-1)?.effective_from ?? today;

  return schedule.terms.at(-2)?.effective_from;
}

function firstFreeDate(after: string | undefined, today: string): string {
  if (after === undefined) return today;

  const next = shiftDate(after, 1);

  return next > today ? next : today;
}
