export interface CurvePoint {
  maturity: string;
  rate: number;
}

// IC13: linear by calendar days between the surrounding points; null outside them.
export function curveRateAt(
  points: readonly CurvePoint[],
  maturity: string,
): number | null {
  const sorted = [...points].sort((a, b) =>
    a.maturity.localeCompare(b.maturity),
  );
  const before = sorted.filter((p) => p.maturity <= maturity).at(-1);
  const after = sorted.find((p) => p.maturity >= maturity);
  if (before === undefined || after === undefined) return null;
  if (before.maturity === after.maturity) return before.rate;

  const span = dayNumber(after.maturity) - dayNumber(before.maturity);
  const elapsed = dayNumber(maturity) - dayNumber(before.maturity);

  return before.rate + ((after.rate - before.rate) * elapsed) / span;
}

// The inflation implied by a nominal and a real rate: (1 + nominal) / (1 + real) - 1.
export function impliedInflation(nominal: number, real: number): number {
  return (1 + nominal) / (1 + real) - 1;
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}
