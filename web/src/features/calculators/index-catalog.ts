import type { FloatingForm } from "@/features/calculators/floating";

// What the calculators know of each index a feed stores (docs/operations/price-feeds.md): its
// name, how a rate over it is quoted, and whether a spread accrues on each stored day.
interface IndexTraits {
  name: string;
  form: FloatingForm;
  // The index stores one rate per calendar day on an actual/360 basis, so a spread adds its
  // 360th to each day; otherwise a spread compounds with the index over the year.
  dailySpread: boolean;
}

const traits: Record<string, IndexTraits> = {
  cdi: { name: "CDI", form: "percent", dailySpread: false },
  ipca: { name: "IPCA", form: "spread", dailySpread: false },
  estr: { name: "€STR", form: "spread", dailySpread: true },
  sofr: { name: "SOFR", form: "spread", dailySpread: true },
  hicp: { name: "HICP", form: "spread", dailySpread: false },
  cpi_u: { name: "CPI-U", form: "spread", dailySpread: false },
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
