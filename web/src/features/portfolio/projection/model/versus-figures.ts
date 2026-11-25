export interface VersusFigures {
  difference: number;
  differenceShare: number;
  monthsAbove: number;
  months: number;
  // Null while no month runs under the plan.
  averageContribution: number | null;
}

// PX7: the last recorded value against the last plan line value, the months above the line and
// the mean of the recorded flows of `planned`, the months under the plan; null without points.
// `points` and `line` cover the same months.
export function versusFigures(
  points: readonly { value: number; flows: number }[],
  line: readonly number[],
  planned: readonly { flows: number }[],
): VersusFigures | null {
  const last = points.at(-1);
  const lastLine = line.at(-1);
  if (last === undefined || lastLine === undefined) return null;

  const difference = last.value - lastLine;
  const flows = planned.reduce((sum, p) => sum + p.flows, 0);

  return {
    difference,
    differenceShare: difference / lastLine,
    monthsAbove: points.filter((p, i) => p.value > (line[i] ?? Infinity))
      .length,
    months: points.length,
    averageContribution: planned.length === 0 ? null : flows / planned.length,
  };
}
