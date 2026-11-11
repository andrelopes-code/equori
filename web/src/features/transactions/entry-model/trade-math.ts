// A live preview of what the server writes (A68). Every product runs on BigInt, so no float
// reaches an amount (O7); the server stays the source of the stored value.
export function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const twice = (numerator % denominator) * 2n;
  if (twice < denominator) return quotient;
  if (twice > denominator) return quotient + 1n;
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}

// gross = round(quantity × unit price) in the scale of the cash currency.
export function grossOf(
  quantity: number,
  quantityScale: number,
  unitPrice: string,
  baseScale: number,
): number {
  const [whole = "0", fraction = ""] = unitPrice.split(".");
  const price = BigInt(whole + fraction);
  const numerator = BigInt(quantity) * price * 10n ** BigInt(baseScale);
  const denominator = 10n ** BigInt(quantityScale + fraction.length);
  return Number(divideHalfEven(numerator, denominator));
}

// The cost basis a sale removes: the whole of it for a full sale.
export function saleCost(
  costBasis: number,
  quantity: number,
  held: number,
): number {
  if (quantity === held) return costBasis;
  return Number(
    divideHalfEven(BigInt(costBasis) * BigInt(quantity), BigInt(held)),
  );
}

export function cashEffect(
  side: "buy" | "sell",
  gross: number,
  fees: number,
  taxes: number,
): number {
  return side === "buy" ? -(gross + fees) : gross - fees - taxes;
}

export function estimatedResult(
  gross: number,
  fees: number,
  cost: number,
): number {
  return gross - fees - cost;
}
