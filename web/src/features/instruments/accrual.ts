import { changeBp } from "@/features/instruments/price-stats";

// The face value, an integer of minor units, as decimal text by string manipulation (O7).
export function faceText(face: number, scale: number): string {
  const digits = String(face).padStart(scale + 1, "0");

  return scale === 0
    ? digits
    : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

// How far the accrued price stands above the face value, in basis points.
export function accruedBp(
  face: number,
  scale: number,
  price: string,
): number | null {
  return changeBp(faceText(face, scale), price);
}
