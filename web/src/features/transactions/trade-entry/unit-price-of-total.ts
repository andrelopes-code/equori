const decimals = 12;

// The unit price whose gross is total: total ÷ quantity, half to even at 12 decimals (A228 IO1).
// Null when the total or the quantity is not positive, or when the rounded price is 0.
export function unitPriceOfTotal(
  total: number,
  totalScale: number,
  quantity: number,
  quantityScale: number,
): string | null {
  if (total <= 0 || quantity <= 0) return null;

  const n = BigInt(total) * 10n ** BigInt(quantityScale + decimals);
  const d = BigInt(quantity) * 10n ** BigInt(totalScale);
  const q = roundHalfEven(n, d);
  if (q === 0n) return null;

  const digits = q.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, "");

  return fraction === "" ? whole : `${whole}.${fraction}`;
}

function roundHalfEven(n: bigint, d: bigint): bigint {
  const q = n / d;
  const twice = (n % d) * 2n;
  if (twice > d || (twice === d && q % 2n === 1n)) return q + 1n;

  return q;
}
