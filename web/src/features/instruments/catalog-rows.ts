import type { components } from "@/api/schema.gen";
import { quoteOf } from "@/features/instruments/quote";

type Instrument = components["schemas"]["Instrument"];

export interface CatalogRow {
  code: string;
  name: string;
  type: string;
  subtype: string;
  quoteCurrency: string;
  exchange: string;
  // The instrument the latest price is quoted in; "" for the base currency, which has none.
  priceQuote: string;
}

// PC20: the securities a reader holds and looks up come first; the many currencies come last.
export function catalogRows(
  items: readonly Instrument[],
  base: string,
): CatalogRow[] {
  return items
    .map((i) => ({
      code: i.code,
      name: i.name,
      type: i.type,
      subtype: i.subtype ?? "",
      quoteCurrency: i.quote_currency ?? "",
      exchange: i.exchange ?? "",
      priceQuote: quoteOf(i, base) ?? "",
    }))
    .sort(
      (a, b) =>
        Number(a.type === "currency") - Number(b.type === "currency") ||
        a.type.localeCompare(b.type) ||
        a.code.localeCompare(b.code),
    );
}
