// Rounds the largest amount up to a step of 2 x 10^(digits - 2), so every bar of a
// screen shares one axis. Amounts are minor units.
export function axisMax(largest: number): number {
  if (largest <= 0) {
    return 0;
  }

  const digits = String(Math.floor(largest)).length;
  const step = Math.max(1, 2 * 10 ** (digits - 2));

  return Math.ceil(largest / step) * step;
}

export function barWidths(parts: number[], max: number): string[] {
  return parts.map((part) =>
    max === 0 ? "0%" : `${String((part / max) * 100)}%`,
  );
}
