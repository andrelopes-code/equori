// PX17: the inputs of the references, each null while it is not typed or not stored.
export interface ScaleInput {
  realBp: number | null;
  cautiousBp: number | null;
  favorableBp: number | null;
  // The longest point of the real curve and the realized real return a year, fractions.
  curve: number | null;
  portfolio: number | null;
}

// A row of the axis: positions from 0 (start) to 1 (end); the plan's row marks its expected return.
export type ScaleRow =
  | { kind: "plan"; from: number; to: number; at: number }
  | { kind: "curve" | "portfolio"; from: number; to: number };

export interface ReferenceScale {
  rows: ScaleRow[];
  ticks: { value: number; at: number }[];
}

const step = 5;

// PX17, PX22: the plan's range against the stored references on one axis of percent a year.
export function referenceScale(input: ScaleInput): ReferenceScale | null {
  const curve = input.curve === null ? null : percent(input.curve);
  const portfolio = input.portfolio === null ? null : percent(input.portfolio);
  if (curve === null && portfolio === null) return null;

  const plan = planRange(input);
  const values = [0, ...(plan ?? []), curve ?? 0, portfolio ?? 0];
  const min = Math.floor(Math.min(...values) / step) * step;
  const max = Math.max(
    Math.ceil(Math.max(...values) / step) * step,
    min + step,
  );
  const at = (value: number) => (value - min) / (max - min);

  const rows: ScaleRow[] = [];
  if (plan !== null)
    rows.push({
      kind: "plan",
      from: at(plan[0]),
      to: at(plan[1]),
      at: at(plan[2]),
    });
  if (curve !== null) rows.push(bar("curve", curve, at));
  if (portfolio !== null) rows.push(bar("portfolio", portfolio, at));

  const ticks = [];
  for (let value = min; value <= max; value += step)
    ticks.push({ value, at: at(value) });

  return { rows, ticks };
}

// The lowest, the highest and the expected return of the plan, in percent.
function planRange(input: ScaleInput): [number, number, number] | null {
  if (input.realBp === null) return null;

  const real = input.realBp / 100;
  return [
    (input.cautiousBp ?? input.realBp) / 100,
    (input.favorableBp ?? input.realBp) / 100,
    real,
  ];
}

// A bar runs from zero to its value, on either side.
function bar(
  kind: "curve" | "portfolio",
  value: number,
  at: (value: number) => number,
): ScaleRow {
  return { kind, from: at(Math.min(0, value)), to: at(Math.max(0, value)) };
}

// A fraction as percent, rounded to the basis point so 0.0754 reads 7.54.
function percent(fraction: number): number {
  return Math.round(fraction * 10000) / 100;
}
