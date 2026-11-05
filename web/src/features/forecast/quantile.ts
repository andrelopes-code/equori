// The p-quantile of the values by linear interpolation between the sorted values; zero for none.
export function quantile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);

  if (sorted.length === 0) return 0;

  const at = (sorted.length - 1) * p;
  const below = Math.floor(at);
  const low = sorted[below] ?? 0;
  const high = sorted[Math.min(below + 1, sorted.length - 1)] ?? low;

  return low + (high - low) * (at - below);
}
