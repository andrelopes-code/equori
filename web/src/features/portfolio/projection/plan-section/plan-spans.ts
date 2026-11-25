// PX17: the whole years of contributions and of withdrawals the line of the plan names.
export interface PlanSpans {
  // PX19: the withdrawals run from today; the contributions have no years.
  started: boolean;
  before: number;
  after: number;
}

// Null while an age is missing, not a whole number, or leaves no year to withdraw.
export function planSpans(
  age: number | null,
  withdrawalAge: string,
  lastAge: string,
): PlanSpans | null {
  const withdrawal = wholeAge(withdrawalAge);
  const last = wholeAge(lastAge);
  if (age === null || withdrawal === null || last === null) return null;

  const start = Math.max(withdrawal, age);
  if (last <= start) return null;

  return {
    started: withdrawal <= age,
    before: start - age,
    after: last - start,
  };
}

function wholeAge(text: string): number | null {
  return /^\d{1,3}$/.test(text.trim()) ? Number(text) : null;
}
