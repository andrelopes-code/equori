// The share of each positive amount in basis points of the sum of the positive amounts: rounded
// down, and the last positive amount takes the remainder so the shares add up to 10000 (the rule
// of getAllocation). An amount that is not positive has no share: a brokerage cash balance below
// zero, counted in the base, would push the others above 10000. Integer arithmetic only.
export function sharesBP(amounts: readonly number[]): number[] {
  const base = amounts.reduce((sum, a) => (a > 0 ? sum + BigInt(a) : sum), 0n);
  if (base === 0n) return amounts.map(() => 0);

  const shares = amounts.map((a) =>
    a > 0 ? Number((BigInt(a) * 10000n) / base) : 0,
  );
  const given = shares.reduce((sum, s) => sum + s, 0);
  const last = amounts.map((a) => a > 0).lastIndexOf(true);
  shares[last] = (shares[last] ?? 0) + 10000 - given;

  return shares;
}
