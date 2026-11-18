import type { FloatingForm } from "@/features/calculators/rate-source/floating";

// What the calculators know of each index a feed stores (docs/operations/price-feeds.md): its
// name, how a rate over it is quoted, its currency, and whether a spread accrues on each stored day.
interface IndexTraits {
  name: string;
  form: FloatingForm;
  currency: string;
  // The index stores one rate per calendar day on an actual/360 basis, so a spread adds its
  // 360th to each day; otherwise a spread compounds with the index over the year.
  dailySpread: boolean;
}

const traits: Record<string, IndexTraits> = {
  cdi: { name: "CDI", form: "percent", currency: "BRL", dailySpread: false },
  ipca: { name: "IPCA", form: "spread", currency: "BRL", dailySpread: false },
  estr: { name: "€STR", form: "spread", currency: "EUR", dailySpread: true },
  sofr: { name: "SOFR", form: "spread", currency: "USD", dailySpread: true },
  hicp: { name: "HICP", form: "spread", currency: "EUR", dailySpread: false },
  cpi_u: { name: "CPI-U", form: "spread", currency: "USD", dailySpread: false },
};

export function indexName(id: string): string {
  return traits[id]?.name ?? id.toUpperCase();
}

export function quotedForm(id: string): FloatingForm {
  return traits[id]?.form ?? "percent";
}

export function dailySpread(id: string): boolean {
  return traits[id]?.dailySpread ?? false;
}

// The currency an index is quoted in; undefined for an index the catalog does not know.
export function indexCurrency(id: string): string | undefined {
  return traits[id]?.currency;
}
