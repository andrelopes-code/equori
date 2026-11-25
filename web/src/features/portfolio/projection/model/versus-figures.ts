export interface VersusFigures {
  difference: number;
  differenceShare: number;
  monthsAbove: number;
  months: number;
  averageContribution: number;
}

// PX7: the last recorded value against the last plan line value, the months above the line and
// the mean of the recorded flows; null without points. `points` and `line` cover the same months.
export function versusFigures(
  points: readonly { value: number; flows: number }[],
  line: readonly number[],
): VersusFigures | null {
  const last = points.at(-1);
  const lastLine = line.at(-1);
  if (last === undefined || lastLine === undefined) return null;

  const difference = last.value - lastLine;
  const flows = points.reduce((sum, p) => sum + p.flows, 0);

  return {
    difference,
    differenceShare: difference / lastLine,
    monthsAbove: points.filter((p, i) => p.value > (line[i] ?? Infinity))
      .length,
    months: points.length,
    averageContribution: flows / points.length,
  };
}
