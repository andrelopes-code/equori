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

export interface CostLot {
  quantity: number;
  cost: number;
}

// A234: the cost of the quantity units the oldest lots give up; a lot the sale closes gives its
// whole cost. Lots arrive oldest first. internal/ledger/domain/testdata/fifo-cost.json holds the
// cases the server (FIFOCost) and this function both satisfy.
export function lotsCost(lots: CostLot[], quantity: number): number {
  let remaining = quantity;
  let cost = 0;
  for (const lot of lots) {
    if (remaining === 0) break;
    const taken = Math.min(remaining, lot.quantity);
    cost +=
      taken === lot.quantity
        ? lot.cost
        : Number(
            divideHalfEven(
              BigInt(lot.cost) * BigInt(taken),
              BigInt(lot.quantity),
            ),
          );
    remaining -= taken;
  }
  return cost;
}

interface Costing {
  method: string;
  lots: { quantity: { amount: number }; cost: { amount: number } }[];
}

// The cost the server records for a sale: the oldest lots under "fifo", the average otherwise.
export function soldCost(
  costing: Costing,
  costBasis: number,
  quantity: number,
  held: number,
): number {
  if (costing.method !== "fifo") return saleCost(costBasis, quantity, held);

  return lotsCost(
    costing.lots.map((l) => ({
      quantity: l.quantity.amount,
      cost: l.cost.amount,
    })),
    quantity,
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
