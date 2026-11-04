// The change of the actual amount against the expected one in basis points; 0 when nothing was
// expected.
export function amountVariance(
  expected: number,
  actual: number,
): { bp: number; differs: boolean } {
  const bp =
    expected === 0 ? 0 : Math.round(((actual - expected) * 10000) / expected);
  return { bp, differs: actual !== expected };
}
