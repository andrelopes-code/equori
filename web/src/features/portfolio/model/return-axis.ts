// Percent steps of the axis ticks (RC5), in the order the smallest fitting one is chosen.
const STEP_PERCENTS = [
  1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200,
  300, 400, 500, 600, 800, 1000,
];

// The domain spans at most this many steps.
const MAX_STEPS = 3;

// Values and ticks are basis points.
export interface ReturnAxis {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

export function comparisonAxis(values: readonly number[]): ReturnAxis {
  const peak = Math.max(0, ...values);
  const trough = Math.max(0, ...values.map((v) => -v));
  const step = stepFor(peak, trough);
  const up = stepsOver(peak, step, peak === 0 && trough === 0 ? 1 : 0);
  const down = stepsOver(trough, step, 0);
  const ticks: number[] = [];

  for (let n = -down; n <= up; n++) {
    // + 0 turns the -0 of n = 0 with a negative step count into 0.
    ticks.push(n * step + 0);
  }

  return { min: ticks[0] ?? 0, max: up * step, step, ticks };
}

export function axisPosition(axis: ReturnAxis, bp: number): number {
  return ((bp - axis.min) * 100) / (axis.max - axis.min);
}

function stepFor(peak: number, trough: number): number {
  for (const step of candidateSteps()) {
    if (stepsOver(peak, step, 0) + stepsOver(trough, step, 0) <= MAX_STEPS) {
      return step;
    }
  }

  throw new Error("comparisonAxis: no step fits the values");
}

// ceil(1.25 * extent / step) over integers; the 1.25 margin leaves room for the value written
// at the bar end.
function stepsOver(extent: number, step: number, empty: number): number {
  if (extent === 0) {
    return empty;
  }

  return Math.ceil((5 * extent) / (4 * step));
}

// The listed steps, then doublings of the last one so an extreme value still gets an axis.
function* candidateSteps(): Generator<number> {
  for (const percent of STEP_PERCENTS) {
    yield percent * 100;
  }

  let step = (STEP_PERCENTS[STEP_PERCENTS.length - 1] ?? 1) * 100;

  while (step < Number.MAX_SAFE_INTEGER / 8) {
    step *= 2;
    yield step;
  }
}
