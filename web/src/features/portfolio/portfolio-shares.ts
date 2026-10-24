// The share of each amount in basis points of their sum: rounded down, and the last takes the
// remainder so the shares add up to 10000 (the rule of getAllocation). Integer arithmetic only.
export function sharesBP(amounts: readonly number[]): number[] {
  const total = amounts.reduce((sum, a) => sum + BigInt(a), 0n);
  if (total === 0n) return amounts.map(() => 0);
  const shares = amounts.map((a) => Number((BigInt(a) * 10000n) / total));
  const given = shares.reduce((sum, s) => sum + s, 0);
  shares[shares.length - 1] = (shares[shares.length - 1] ?? 0) + 10000 - given;
  return shares;
}
