import type { components } from "@/api/schema.gen";

type Instrument = components["schemas"]["Instrument"];

// A currency quotes in the base currency, which has no price of its own.
export function quoteOf(instrument: Instrument, base: string): string | null {
  const quote = instrument.quote_currency ?? base;
  return quote === instrument.code ? null : quote;
}
