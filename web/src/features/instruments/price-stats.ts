import type { components } from "@/api/schema.gen";

type Price = components["schemas"]["Price"];

export interface PriceStats {
  first: Price;
  last: Price;
  // The change from the first to the last price; null with one price or a first price of zero.
  changeBp: number | null;
  high: Price;
  low: Price;
  count: number;
}

// A price is an exact decimal of at most 12 places (ADR 005): it is compared and divided as a
// scaled integer, never as a float.
const places = 12;

export function priceStats(prices: readonly Price[]): PriceStats | null {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) return null;

  let high = first;
  let low = first;
  for (const p of sorted) {
    if (scaled(p.value) > scaled(high.value)) high = p;
    if (scaled(p.value) < scaled(low.value)) low = p;
  }

  return {
    first,
    last,
    changeBp: sorted.length < 2 ? null : changeBp(first.value, last.value),
    high,
    low,
    count: sorted.length,
  };
}

// The change between two exact decimals in basis points, halves away from zero.
export function changeBp(from: string, to: string): number | null {
  const base = scaled(from);
  if (base === 0n) return null;

  const diff = (scaled(to) - base) * 10000n;
  const size = diff < 0n ? -diff : diff;
  const half = base < 0n ? -base : base;
  const rounded = (size * 2n + half) / (half * 2n);

  return Number(diff < 0n ? -rounded : rounded);
}

// The decimals a unit price is written with: two at least, four from one unit, eight below one
// unit, and two from a thousand units, where more digits only add noise.
export function priceDigits(value: string): number {
  const [whole = "0", fraction = ""] = value.split(".");
  const decimals = fraction.length;
  if (whole.length >= 4) return 2;
  if (Number(whole) >= 1) return Math.min(Math.max(decimals, 2), 4);

  return Math.min(Math.max(decimals, 2), 8);
}

// The price as an integer of 10^-digits units, halves up; a price is positive.
export function priceAmount(value: string, digits: number): number {
  const unit = 10n ** BigInt(places - digits);

  return Number((scaled(value) + unit / 2n) / unit);
}

function scaled(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".");

  return BigInt(whole + fraction.slice(0, places).padEnd(places, "0"));
}
