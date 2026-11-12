const total = 10000;

// Moves a target and spreads the difference over the unlocked others; the sum stays 10000.
export function redistributeTargets(
  targets: number[],
  locked: boolean[],
  index: number,
  next: number,
): number[] {
  const current = targets[index] ?? 0;
  const others = targets.map((_, i) => i).filter((i) => i !== index);
  const lockedSum = others
    .filter((i) => locked[i] === true)
    .reduce((sum, i) => sum + (targets[i] ?? 0), 0);
  const unlocked = others.filter((i) => locked[i] !== true);
  const clamped = Math.min(Math.max(next, 0), total - lockedSum);
  if (unlocked.length === 0) return [...targets];

  const delta = clamped - current;
  const weights = unlocked.map((i) => targets[i] ?? 0);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const useEqual = delta < 0 && weightSum === 0;
  const parts = spread(
    Math.abs(delta),
    useEqual ? weights.map(() => 1) : weights,
  );

  const result = [...targets];
  result[index] = clamped;
  unlocked.forEach((i, k) => {
    result[i] = (targets[i] ?? 0) - Math.sign(delta) * (parts[k] ?? 0);
  });

  return result;
}

// Splits an amount in proportion to the weights: floor, then largest remainder by index order.
function spread(amount: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum === 0) return weights.map(() => 0);

  const parts = weights.map((w) => Math.floor((amount * w) / weightSum));
  const remainders = weights
    .map((w, i) => ({ i, rest: (amount * w) % weightSum }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  const left = amount - parts.reduce((sum, p) => sum + p, 0);
  for (const { i } of remainders.slice(0, left)) parts[i] = (parts[i] ?? 0) + 1;

  return parts;
}
