// The part of a purchase's cash effect that the cash balance does not cover, in minor units of the
// base currency; null when the purchase is covered, is a sale, or a figure is missing (BC8).
export function shortfall(
  cashEffect: number | null,
  balance: number | undefined,
): number | null {
  if (cashEffect === null || balance === undefined || cashEffect >= 0)
    return null;
  const missing = -cashEffect - balance;
  return missing > 0 ? missing : null;
}
