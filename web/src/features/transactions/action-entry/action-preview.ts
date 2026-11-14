const places = 12;

export interface ActionPreview {
  // Minor units of the instrument.
  received: number;
  // A decimal of at most 12 places, "0" when nothing is left over (A228 IO26).
  fraction: string;
}

// The units after an action and the fraction left out, as the server computes them (IO24): the
// held quantity times to, divided by from, with the remainder over from as the fraction.
export function actionPreview(
  held: number,
  ratioFrom: number,
  ratioTo: number,
  scale: number,
): ActionPreview | null {
  if (ratioFrom <= 0 || ratioTo <= 0) return null;

  const product = BigInt(held) * BigInt(ratioTo);
  const from = BigInt(ratioFrom);

  return {
    received: Number(product / from),
    fraction: fractionText(product % from, from * BigInt(10) ** BigInt(scale)),
  };
}

function fractionText(remainder: bigint, denominator: bigint): string {
  if (remainder === BigInt(0)) return "0";

  const digits = (remainder * BigInt(10) ** BigInt(places)) / denominator;

  return `0.${digits.toString().padStart(places, "0").replace(/0+$/, "")}`;
}
