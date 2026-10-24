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

export function catalogRows(
  items: readonly Instrument[],
  base: string,
): CatalogRow[] {
  return items.map((i) => ({
    code: i.code,
    name: i.name,
    type: i.type,
    subtype: i.subtype ?? "",
    quoteCurrency: i.quote_currency ?? "",
    exchange: i.exchange ?? "",
    priceQuote: quoteOf(i, base) ?? "",
  }));
}
