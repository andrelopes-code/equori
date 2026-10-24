import type { components } from "@/api/schema.gen";

type Instrument = components["schemas"]["Instrument"];
type Price = components["schemas"]["Price"];

// The contract's enumeration of InstrumentType, in the order the catalog lists the types.
export const instrumentTypes = [
  "currency",
  "stock",
  "etf",
  "reit",
  "depositary_receipt",
  "fixed_income",
  "fund",
  "crypto",
] as const satisfies readonly components["schemas"]["InstrumentType"][];

export interface InstrumentGroup {
  type: string;
  items: Instrument[];
}

const rank = (type: string): number => {
  const index = (instrumentTypes as readonly string[]).indexOf(type);
  return index === -1 ? instrumentTypes.length : index;
};

// A type the contract gains later still lists, after the known ones in name order.
export function groupByType(items: readonly Instrument[]): InstrumentGroup[] {
  const groups = new Map<string, Instrument[]>();
  for (const item of items) {
    const group = groups.get(item.type);
    if (group === undefined) groups.set(item.type, [item]);
    else group.push(item);
  }
  return [...groups]
    .map(([type, list]) => ({ type, items: list }))
    .sort(
      (a, b) => rank(a.type) - rank(b.type) || a.type.localeCompare(b.type),
    );
}

export function latestPrice(prices: readonly Price[]): Price | undefined {
  return prices.reduce<Price | undefined>(
    (best, p) => (best === undefined || p.date > best.date ? p : best),
    undefined,
  );
}
