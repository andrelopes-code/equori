import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { latestPriceQuery } from "@/features/instruments/api";
import { settingsQuery } from "@/features/setup";
import { useToday } from "@/i18n/today";

type Instrument = components["schemas"]["Instrument"];
type Price = components["schemas"]["Price"];

export interface LatestPrice {
  pending: boolean;
  failed: boolean;
  price: Price | null;
}

// A currency quotes in the base currency, which has no price of its own.
export function quoteOf(instrument: Instrument, base: string): string | null {
  const quote = instrument.quote_currency ?? base;
  return quote === instrument.code ? null : quote;
}

// One request per instrument, as the contract has no listing of latest prices.
export function useLatestPrices(
  instruments: readonly Instrument[],
): ReadonlyMap<string, LatestPrice> {
  const api = useApi();
  const today = useToday();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const quotes = instruments.map((i) =>
    base === undefined ? null : quoteOf(i, base),
  );
  const results = useQueries({
    queries: instruments.map((instrument, index) => {
      const quote = quotes[index] ?? null;
      return {
        ...latestPriceQuery(api, instrument.code, quote ?? "", today),
        enabled: quote !== null,
      };
    }),
  });
  const map = new Map<string, LatestPrice>();
  instruments.forEach((instrument, index) => {
    const result = results[index];
    const quote = quotes[index];
    map.set(instrument.code, {
      pending:
        base === undefined || (quote !== null && (result?.isPending ?? true)),
      failed: result?.isError ?? false,
      price: result?.data ?? null,
    });
  });
  return map;
}
