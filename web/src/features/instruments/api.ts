import { queryOptions, useMutation } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import { latestPrice } from "@/features/instruments/instrument-groups";
import { priceWindow } from "@/features/instruments/price-window";

export const instrumentKeys = {
  all: ["instruments"] as const,
  instrument: (code: string) => ["instruments", "instrument", code] as const,
  subtypes: (type: string) => ["instruments", "subtypes", type] as const,
  prices: (instrument: string, quote: string, from: string, to: string) =>
    ["instruments", "prices", instrument, quote, from, to] as const,
  latest: (instrument: string, quote: string, today: string) =>
    ["instruments", "latest", instrument, quote, today] as const,
};

type InstrumentType = components["schemas"]["InstrumentType"];

export function subtypesQuery(api: Client<paths>, type: InstrumentType) {
  return queryOptions({
    queryKey: instrumentKeys.subtypes(type),
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/instrument-subtypes", {
            params: { query: { type } },
          }),
        )
      ).items,
    staleTime: Infinity,
  });
}

async function fetchPrices(
  api: Client<paths>,
  instrument: string,
  quote: string,
  from: string,
  to: string,
) {
  return (
    await unwrap(
      await api.GET("/prices", {
        params: { query: { instrument, quote_instrument: quote, from, to } },
      }),
    )
  ).items;
}

export function pricesQuery(
  api: Client<paths>,
  instrument: string,
  quote: string,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: instrumentKeys.prices(instrument, quote, from, to),
    queryFn: () => fetchPrices(api, instrument, quote, from, to),
  });
}

// The contract has no latest-price operation: the greatest date of the longest window stands for it.
export function latestPriceQuery(
  api: Client<paths>,
  instrument: string,
  quote: string,
  today: string,
) {
  const { from, to } = priceWindow(today, Infinity);
  return queryOptions({
    queryKey: instrumentKeys.latest(instrument, quote, today),
    queryFn: async () =>
      latestPrice(await fetchPrices(api, instrument, quote, from, to)) ?? null,
  });
}

export function useDefineInstrument() {
  const api = useApi();
  return useMutation({
    mutationFn: async (input: components["schemas"]["InstrumentInput"]) =>
      unwrap(await api.POST("/instruments", { body: input })),
  });
}

export function instrumentQuery(api: Client<paths>, code: string) {
  return queryOptions({
    queryKey: instrumentKeys.instrument(code),
    queryFn: async () =>
      unwrap(
        await api.GET("/instruments/{code}", { params: { path: { code } } }),
      ),
  });
}

export function useRecordPrice() {
  const api = useApi();
  return useMutation({
    mutationFn: async (input: components["schemas"]["PriceInput"]) =>
      unwrap(await api.POST("/prices", { body: input })),
  });
}
