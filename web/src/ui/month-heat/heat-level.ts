// The sizes, in fractions, at which the second, the third and the fourth strength start.
export type HeatSteps = readonly [number, number, number];

const portfolioSteps: HeatSteps = [0.01, 0.03, 0.06];

// PR8: the strength of a cell by the size of its change; zero takes none.
export function heatLevel(
  value: number | null,
  steps: HeatSteps = portfolioSteps,
): { tone: "gain" | "loss"; level: 1 | 2 | 3 | 4 } | null {
  if (value === null || value === 0) return null;

  const size = Math.abs(value);
  const [second, third, fourth] = steps;
  const level = size < second ? 1 : size < third ? 2 : size < fourth ? 3 : 4;

  return { tone: value > 0 ? "gain" : "loss", level };
}
