import type { components } from "@/api/schema.gen";
import { changeBp } from "@/features/instruments/model/price-stats";

type Price = components["schemas"]["Price"];

export interface QuoteReading {
  price: Price;
  reference: Price | null;
  // What the change is measured against: the quote before the latest, or the start of the range.
  basis: "previous" | "start";
  changeBp: number | null;
}

// The price the hero shows. A point of the chart that the pointer or the keyboard reads
// (activeDate) wins; otherwise the latest quote of the recent window.
export function quoteReading(
  recent: readonly Price[],
  shown: readonly Price[],
  activeDate: string | null,
): QuoteReading | null {
  const active = shown.find((p) => p.date === activeDate);
  if (active !== undefined) return startReading(active, shown);

  const sorted = [...recent].sort((a, b) => a.date.localeCompare(b.date));
  const price = sorted.at(-1);
  if (price === undefined) return null;

  const previous = sorted.at(-2) ?? null;

  return {
    price,
    reference: previous,
    basis: "previous",
    changeBp: previous === null ? null : changeBp(previous.value, price.value),
  };
}

function startReading(point: Price, shown: readonly Price[]): QuoteReading {
  const start = [...shown].sort((a, b) => a.date.localeCompare(b.date))[0];
  const reference = start === undefined || start === point ? null : start;

  return {
    price: point,
    reference,
    basis: "start",
    changeBp:
      reference === null ? null : changeBp(reference.value, point.value),
  };
}
