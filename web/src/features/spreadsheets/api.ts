import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";
import { useCallback } from "react";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";

export type SpreadsheetSummary = components["schemas"]["SpreadsheetSummary"];
export type SpreadsheetContent = components["schemas"]["SpreadsheetContent"];

const listKey = ["spreadsheets", "list"] as const;

export function spreadsheetsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: listKey,
    queryFn: async () => (await unwrap(await api.GET("/spreadsheets"))).items,
  });
}

export type SpreadsheetDocument = components["schemas"]["Spreadsheet"];

// The editor holds the content after it opens, so a spreadsheet is read once per opening and
// kept out of the query cache: a cached content would be older than the one last saved, and a
// write elsewhere in the application would read megabytes again.
export async function fetchSpreadsheet(
  api: Client<paths>,
  id: string,
): Promise<SpreadsheetDocument> {
  return unwrap(
    await api.GET("/spreadsheets/{id}", { params: { path: { id } } }),
  );
}

// A save of the editor is not a mutation of the query client: a mutation marks every query
// stale, and the editor saves after each pause in typing.
export function useSaveSpreadsheet() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useCallback(
    async (
      id: string,
      content: SpreadsheetContent,
      version: number,
    ): Promise<SpreadsheetSummary> => {
      const saved = await unwrap(
        await api.PUT("/spreadsheets/{id}", {
          params: { path: { id } },
          body: { content, version },
        }),
      );
      void queryClient.invalidateQueries({ queryKey: listKey });
      return saved;
    },
    [api, queryClient],
  );
}

export function useCreateSpreadsheet() {
  const api = useApi();
  return useMutation({
    mutationFn: async (body: { name: string; content: SpreadsheetContent }) =>
      unwrap(await api.POST("/spreadsheets", { body })),
  });
}

export function useRenameSpreadsheet() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      unwrap(
        await api.PUT("/spreadsheets/{id}/name", {
          params: { path: { id } },
          body: { name },
        }),
      ),
  });
}

export function useCopySpreadsheet() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      unwrap(
        await api.POST("/spreadsheets/{id}/copies", {
          params: { path: { id } },
          body: { name },
        }),
      ),
  });
}

export function useDeleteSpreadsheet() {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE("/spreadsheets/{id}", { params: { path: { id } } }),
      ),
  });
}
