import {
  queryOptions,
  skipToken,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { ProblemError, unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import { latestPrice } from "@/features/instruments/model/instrument-groups";
import { priceWindow } from "@/features/instruments/model/price-window";
import { bulkOutcome } from "@/ui/feedback/bulk-outcome";
import type { BulkItem } from "@/ui/feedback/bulk-outcome";

export const instrumentKeys = {
  all: ["instruments"] as const,
  instrument: (code: string) => ["instruments", "instrument", code] as const,
  terms: (code: string) => ["instruments", "terms", code] as const,
  subtypes: (type: string) => ["instruments", "subtypes", type] as const,
  prices: (instrument: string, quote: string, from: string, to: string) =>
    ["instruments", "prices", instrument, quote, from, to] as const,
  series: (instrument: string, quote: string, from: string, to: string) =>
    ["instruments", "series", instrument, quote, from, to] as const,
  latest: (instrument: string, quote: string, today: string) =>
    ["instruments", "latest", instrument, quote, today] as const,
  quotes: (base: string) => ["instruments", "quotes", base] as const,
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

async function fetchPriceList(
  api: Client<paths>,
  instrument: string,
  quote: string,
  from: string,
  to: string,
) {
  return unwrap(
    await api.GET("/prices", {
      params: { query: { instrument, quote_instrument: quote, from, to } },
    }),
  );
}

async function fetchPrices(
  api: Client<paths>,
  instrument: string,
  quote: string,
  from: string,
  to: string,
) {
  return (await fetchPriceList(api, instrument, quote, from, to)).items;
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

// Every date with a price in the range (MQ30).
export function priceSeriesQuery(
  api: Client<paths>,
  instrument: string,
  quote: string,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: instrumentKeys.series(instrument, quote, from, to),
    queryFn: () => fetchPriceList(api, instrument, quote, from, to),
  });
}

// The contract has no latest-price operation: the greatest date of the longest window stands for it.
export function latestPriceQuery(
  api: Client<paths>,
  instrument: string,
  quote: string,
  today: string,
) {
  const { from, to } = priceWindow(today, 366);
  return queryOptions({
    queryKey: instrumentKeys.latest(instrument, quote, today),
    queryFn: async () =>
      latestPrice(await fetchPrices(api, instrument, quote, from, to)) ?? null,
  });
}

// The last price and the prices the changes start from, of every instrument (IQ1).
export function instrumentQuotesQuery(api: Client<paths>, base: string) {
  return queryOptions({
    queryKey: instrumentKeys.quotes(base),
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/instrument-quotes", { params: { query: { base } } }),
        )
      ).items,
  });
}

// The monthly reports of a listed fund, newest period first; an empty list when none is stored.
// The report sets of an instrument and, while it has none from a source, the funds that share its
// code (FR15).
export function fundReportListQuery(api: Client<paths>, code: string) {
  return queryOptions({
    queryKey: [...instrumentKeys.all, "fund-reports", code] as const,
    queryFn: async () =>
      unwrap(await api.GET("/fund-reports", { params: { query: { code } } })),
  });
}

export function fundReportsQuery(api: Client<paths>, code: string) {
  return queryOptions({
    ...fundReportListQuery(api, code),
    select: (list) => list.items,
  });
}

// The statements of the company an instrument stands for, one report set per enabled source; an
// empty list when none is stored (CR6).
export function companyReportsQuery(api: Client<paths>, code: string) {
  return queryOptions({
    queryKey: [...instrumentKeys.all, "company-reports", code] as const,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/company-reports", { params: { query: { code } } }),
        )
      ).items,
  });
}

// The figures of the company an instrument stands for, one set per report set of companyReportsQuery
// (AC14).
export function companyFiguresQuery(api: Client<paths>, code: string) {
  return queryOptions({
    queryKey: [...instrumentKeys.all, "company-figures", code] as const,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/company-figures", { params: { query: { code } } }),
        )
      ).items,
  });
}

export function catalogQuery(api: Client<paths>, q: string) {
  return queryOptions({
    queryKey: [...instrumentKeys.all, "catalog", q] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/market-data/catalog", { params: { query: { q } } }),
      ),
    staleTime: 60_000,
  });
}

export function probeQuery(
  api: Client<paths>,
  input: components["schemas"]["ProbeInput"] | null,
) {
  return queryOptions({
    queryKey: [...instrumentKeys.all, "probe", input] as const,
    queryFn:
      input === null
        ? skipToken
        : async () =>
            unwrap(await api.POST("/market-data/probe", { body: input })),
    staleTime: 60_000,
    retry: false,
  });
}

export function useDefineInstrument() {
  const api = useApi();
  return useMutation({
    mutationFn: async (input: components["schemas"]["InstrumentInput"]) =>
      unwrap(await api.POST("/instruments", { body: input })),
  });
}

export function useDeleteInstrument() {
  const api = useApi();
  return useMutation({
    mutationFn: async (code: string) =>
      unwrap(
        await api.DELETE("/instruments/{code}", {
          params: { path: { code } },
        }),
      ),
  });
}

export function useSetInstrumentHidden() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({ code, hidden }: { code: string; hidden: boolean }) =>
      unwrap(await setHidden(api, code, hidden)),
  });
}

// Every code is tried: a refused one never stops the others, and the outcome names it (A238 HD13).
// shortcut: one request per code; a bulk operation when selections of hundreds are common.
export function useSetInstrumentsHidden() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      codes,
      hidden,
    }: {
      codes: readonly string[];
      hidden: boolean;
    }) => {
      const results = await Promise.all(
        codes.map(async (code): Promise<BulkItem> => {
          try {
            await unwrap(await setHidden(api, code, hidden));
            return { id: code, status: "done" };
          } catch (error) {
            return { id: code, status: refusalStatus(error) };
          }
        }),
      );

      return bulkOutcome(results, "done");
    },
  });
}

function setHidden(api: Client<paths>, code: string, hidden: boolean) {
  const params = { path: { code } };

  return hidden
    ? api.PUT("/instruments/{code}/hidden", { params })
    : api.DELETE("/instruments/{code}/hidden", { params });
}

// A request that never reached the server has no problem code: it reads as problem.transport.
function refusalStatus(error: unknown): string {
  return error instanceof ProblemError ? error.problem.code : "transport";
}

export function useEditInstrument() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      code,
      edit,
    }: {
      code: string;
      edit: components["schemas"]["InstrumentEdit"];
    }) =>
      unwrap(
        await api.PATCH("/instruments/{code}", {
          params: { path: { code } },
          body: edit,
        }),
      ),
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

export function useRequestHistory() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, from }: { code: string; from: string }) =>
      unwrap(
        await api.POST("/instruments/{code}/history", {
          params: { path: { code } },
          body: { from },
        }),
      ),
    onSuccess: (_data, { code }) =>
      client.invalidateQueries({ queryKey: instrumentKeys.instrument(code) }),
  });
}

// An instrument without terms answers 404, which reads as "no terms yet".
export function termsQuery(api: Client<paths>, code: string) {
  return queryOptions({
    queryKey: instrumentKeys.terms(code),
    queryFn: async () => {
      try {
        return await unwrap(
          await api.GET("/instruments/{code}/terms", {
            params: { path: { code } },
          }),
        );
      } catch (error) {
        if (error instanceof ProblemError && error.problem.status === 404)
          return null;
        throw error;
      }
    },
  });
}

export function usePutTerms() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      code,
      terms,
    }: {
      code: string;
      terms: components["schemas"]["FixedIncomeTermsInput"];
    }) =>
      unwrap(
        await api.PUT("/instruments/{code}/terms", {
          params: { path: { code } },
          body: terms,
        }),
      ),
  });
}

export function useImportPrices() {
  const api = useApi();
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return unwrap(
        await api.POST("/prices/import", {
          // openapi-fetch sends FormData as it is, with the boundary the browser writes.
          body: body as unknown as { file: string },
          bodySerializer: (value) => value as unknown as FormData,
        }),
      );
    },
  });
}

// A dry run stores nothing and leaves the cached quotes as they are.
export function useRecordInstrumentPrices() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      code,
      quote,
      prices,
      dryRun,
    }: {
      code: string;
      quote: string;
      prices: components["schemas"]["InstrumentPricePoint"][];
      dryRun: boolean;
    }) =>
      unwrap(
        await api.POST("/instruments/{code}/prices", {
          params: { path: { code } },
          body: {
            quote_instrument: quote,
            prices,
            ...(dryRun ? { dry_run: true } : {}),
          },
        }),
      ),
    onSuccess: (_data, { dryRun }) =>
      dryRun
        ? undefined
        : client.invalidateQueries({ queryKey: instrumentKeys.all }),
  });
}
