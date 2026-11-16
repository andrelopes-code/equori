import type { components } from "@/api/schema.gen";
import { quoteOf } from "@/features/instruments/model/quote";
import { changeBp } from "@/features/instruments/model/price-stats";

type Instrument = components["schemas"]["Instrument"];
type InstrumentQuote = components["schemas"]["InstrumentQuote"];
type QuotePoint = components["schemas"]["QuotePoint"];

export interface CatalogRow {
  code: string;
  name: string;
  type: string;
  subtype: string;
  quoteCurrency: string;
  exchange: string;
  // The book hides the instrument from its lists (A238 HD9).
  hidden: boolean;
  // The instrument the latest price is quoted in; "" for the base currency, which has none.
  priceQuote: string;
  // The last price and its date; "" when the instrument has none or the quotes did not load.
  lastValue: string;
  lastDate: string;
  // The change from each reference price to the last price, in basis points; null when there is
  // no reference price (IQ5, IQ6).
  week: number | null;
  month: number | null;
  quarter: number | null;
  year: number | null;
  yearToDate: number | null;
  // The price on each of the 31 dates of IQ13, oldest first; null before the first price. Empty
  // when the instrument has no price or the quotes did not load.
  trend: (number | null)[];
}

// PC20: the securities a reader holds and looks up come first; the many currencies come last.
export function catalogRows(
  items: readonly Instrument[],
  base: string,
  quotes: readonly InstrumentQuote[],
): CatalogRow[] {
  const byCode = new Map(quotes.map((q) => [q.instrument, q]));

  return items
    .map((i) => {
      const quote = byCode.get(i.code);
      const last = quote?.last ?? null;
      const refs = quote?.references;

      return {
        code: i.code,
        name: i.name,
        type: i.type,
        subtype: i.subtype ?? "",
        quoteCurrency: i.quote_currency ?? "",
        exchange: i.exchange ?? "",
        hidden: i.hidden,
        priceQuote: quoteOf(i, base) ?? "",
        lastValue: last?.value ?? "",
        lastDate: last?.date ?? "",
        week: change(refs?.week, last),
        month: change(refs?.month, last),
        quarter: change(refs?.quarter, last),
        year: change(refs?.year, last),
        yearToDate: change(refs?.year_to_date, last),
        trend: (quote?.trend ?? []).map((value) =>
          value === null ? null : Number(value),
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(a.type === "currency") - Number(b.type === "currency") ||
        a.type.localeCompare(b.type) ||
        a.code.localeCompare(b.code),
    );
}

function change(
  reference: QuotePoint | null | undefined,
  last: QuotePoint | null,
): number | null {
  if (reference === null || reference === undefined || last === null)
    return null;

  return changeBp(reference.value, last.value);
}
