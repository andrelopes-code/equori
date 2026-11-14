// Splits amount over weights as the server does (domain.Apportion, A228 IO18): each share is the
// floor of amount × weight ÷ Σ weights, and the units left go one each to the largest remainders,
// ties to the lower index. A zero weight takes nothing; all zero weights return zeros.
export function apportion(
  amount: number,
  weights: readonly number[],
): number[] {
  const sum = weights.reduce((total, weight) => total + BigInt(weight), 0n);
  if (sum === 0n || amount === 0) return weights.map(() => 0);

  const parts = weights.map((weight, index) => {
    const product = BigInt(amount) * BigInt(weight);
    return { index, share: product / sum, remainder: product % sum };
  });
  const left = parts.reduce((rest, part) => rest - part.share, BigInt(amount));
  const largest = [...parts]
    .sort((a, b) => compareDescending(a.remainder, b.remainder))
    .slice(0, Number(left))
    .map((part) => part.index);

  return parts.map(
    (part) => Number(part.share) + (largest.includes(part.index) ? 1 : 0),
  );
}

function compareDescending(a: bigint, b: bigint): number {
  if (a === b) return 0;
  return a < b ? 1 : -1;
}
