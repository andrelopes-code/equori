import type { components } from "@/api/schema.gen";
import { zoomedRange } from "@/features/instruments/price-chart/price-axis";

type Price = components["schemas"]["Price"];

export interface Zoom {
  start: number;
  end: number;
}

export const wholeRange: Zoom = { start: 0, end: 1 };

// The prices, oldest first, that fall inside the window a zoom leaves visible, ends included.
export function pricesInZoom(prices: readonly Price[], zoom: Zoom): Price[] {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) return [];

  const window = zoomedRange(
    Date.parse(first.date),
    Date.parse(last.date),
    zoom,
  );

  return sorted.filter((p) => {
    const day = Date.parse(p.date);

    return day >= window.first && day <= window.last;
  });
}
