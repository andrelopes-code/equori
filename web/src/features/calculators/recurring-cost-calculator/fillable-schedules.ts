import type { Per } from "@/features/calculators/recurring-cost-calculator/recurring-answer";

export interface FillableSchedule {
  id: string;
  name: string;
  // Minor units, positive.
  amount: number;
  per: Per;
}

interface ScheduleInput {
  id: string;
  description: string;
  terms: {
    amount: { amount: number; currency: string };
    recurrence: { frequency: string; interval: number };
  }[];
}

// A schedule fills the amount of its latest terms when it recurs every month or every year in
// the base currency.
export function fillableSchedules(
  schedules: readonly ScheduleInput[],
  currency: string,
): FillableSchedule[] {
  return schedules.flatMap((s) => {
    const terms = s.terms.at(-1);
    if (terms?.amount.currency !== currency || terms.recurrence.interval !== 1)
      return [];

    const per = perOf(terms.recurrence.frequency);

    return per === null
      ? []
      : [
          {
            id: s.id,
            name: s.description,
            amount: Math.abs(terms.amount.amount),
            per,
          },
        ];
  });
}

function perOf(frequency: string): Per | null {
  if (frequency === "monthly") return "month";
  if (frequency === "yearly") return "year";

  return null;
}
