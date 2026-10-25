import { divideHalfEven } from "@/features/transactions/trade-math";

// A live preview of what the server writes (S16, S17). BigInt throughout, so no float reaches an
// amount (O7). The converted amount is `grossOf` of trade-math: amount × rate, rounded half to even.

// The foreign charge: converted × bp ÷ 10000, in the scale of the converted amount.
export function chargeOf(converted: number, bp: number): number {
  return Number(divideHalfEven(BigInt(converted) * BigInt(bp), 10000n));
}

const ratioDecimals = 6;

// numerator ÷ denominator per whole unit of each instrument, as exact decimal text with at least
// four places.
export function ratioText(
  numerator: number,
  numeratorScale: number,
  denominator: number,
  denominatorScale: number,
): string {
  const scaled = divideHalfEven(
    BigInt(numerator) * 10n ** BigInt(denominatorScale + ratioDecimals),
    BigInt(denominator) * 10n ** BigInt(numeratorScale),
  );
  const digits = scaled.toString().padStart(ratioDecimals + 1, "0");
  const whole = digits.slice(0, -ratioDecimals);
  const fraction = digits.slice(-ratioDecimals).replace(/0+$/, "");
  return `${whole}.${fraction.padEnd(4, "0")}`;
}

function decimalUnits(text: string, places: number): bigint {
  const [whole = "0", fraction = ""] = text.split(".");
  return BigInt(whole + fraction.padEnd(places, "0"));
}

// (rate − reference) ÷ reference in basis points, rounded half to even.
export function differenceBP(rate: string, reference: string): number {
  const places = 12;
  const r = decimalUnits(rate, places);
  const p = decimalUnits(reference, places);
  const delta = (r - p) * 10000n;
  // divideHalfEven reads a non-negative numerator.
  return delta < 0n
    ? -Number(divideHalfEven(-delta, p))
    : Number(divideHalfEven(delta, p));
}
