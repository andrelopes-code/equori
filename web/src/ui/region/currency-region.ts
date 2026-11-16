import { regions } from "@/i18n/regions";

const known = new Set<string>(regions);

// The region whose flag stands for a currency: the first two letters of an ISO 4217 code are the
// ISO 3166 code of its country. Shortcut: a currency of a withdrawn or shared code (XOF, ANG) has
// none, and a flag stands for a country, not for the currency's whole union.
export function currencyRegion(code: string): string | null {
  if (code === "EUR") return "EU";
  if (code.startsWith("X")) return null;
  const region = code.slice(0, 2);

  return known.has(region) ? region : null;
}
