import type { components } from "@/api/schema.gen";

type Value = components["schemas"]["AssistantValue"];

// The decimal string of the API ("1234.56") becomes an integer and its scale by string
// manipulation (O7).
export function minorUnits(decimal: string): { minor: number; scale: number } {
  const [, fraction = ""] = decimal.split(".");

  return { minor: Number(decimal.replace(".", "")), scale: fraction.length };
}

// A net below zero leaves the cash account (investment proposals design, IP1).
export function leaves(value: Value): boolean {
  return value.amount?.startsWith("-") ?? false;
}

export function absolute(value: Value): Value {
  return value.amount === undefined
    ? value
    : { ...value, amount: value.amount.replace("-", "") };
}

// The price of an order in the currency of its amount, with at least the amount's decimals.
export function priced(
  price: Value | undefined,
  amount: Value | undefined,
): Value | undefined {
  const text = price?.text;
  if (text === undefined || amount?.amount === undefined) return price;

  const decimals = minorUnits(amount.amount).scale;
  const [whole = "", fraction = ""] = text.split(".");
  const padded = fraction.padEnd(decimals, "0");

  return {
    ...amount,
    amount: padded === "" ? whole : `${whole}.${padded}`,
  };
}

// The sum of amounts of one currency and scale; undefined without amounts.
export function sumOf(values: readonly Value[]): Value | undefined {
  const [first] = values;
  if (first?.amount === undefined) return undefined;

  const { scale } = minorUnits(first.amount);
  const minor = values.reduce(
    (sum, value) => sum + minorUnits(value.amount ?? "0").minor,
    0,
  );

  return { ...first, amount: decimalOf(minor, scale) };
}

function decimalOf(minor: number, scale: number): string {
  const digits = String(Math.abs(minor)).padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const sign = minor < 0 ? "-" : "";

  return scale === 0
    ? `${sign}${whole}`
    : `${sign}${whole}.${digits.slice(-scale)}`;
}
