import type { components } from "@/api/schema.gen";

type Occurrence = components["schemas"]["Occurrence"];

const RECENT = 3;
const MIN_DRIFT_BP = 100;

// The median of the 3 most recent actual amounts when each differs from the expected amount by
// at least 100 bp, all on the same side of it; null otherwise. `actuals` is newest first.
export function suggestTermsAmount(
  expected: number,
  actuals: number[],
): number | null {
  const recent = actuals.slice(0, RECENT);
  if (recent.length < RECENT) return null;

  const drifts = recent.every(
    (actual) => Math.abs(actual - expected) * 10000 >= expected * MIN_DRIFT_BP,
  );
  const sameSide =
    recent.every((actual) => actual > expected) ||
    recent.every((actual) => actual < expected);
  if (!drifts || !sameSide) return null;

  return [...recent].sort((a, b) => a - b)[1] ?? null;
}

// The actual amounts of the realized occurrences, newest first.
export function realizedActuals(occurrences: readonly Occurrence[]): number[] {
  return occurrences
    .filter((o) => o.state === "realized")
    .sort((a, b) => b.expected_on.localeCompare(a.expected_on))
    .flatMap((o) =>
      o.actual_amount === undefined ? [] : [o.actual_amount.amount],
    );
}

// The date of the next occurrence still expected.
export function nextExpectedOn(
  occurrences: readonly Occurrence[],
): string | undefined {
  return occurrences
    .filter((o) => o.state === "expected")
    .map((o) => o.expected_on)
    .sort()[0];
}
