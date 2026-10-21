import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import { accountKeys } from "@/features/accounts";
import type { CategoryClass } from "@/features/categories/category-paths";

type AccountInput = components["schemas"]["AccountInput"];

export const categoryKeys = {
  totals: (from: string, to: string, cls: CategoryClass) =>
    ["reports", "categories", from, to, cls] as const,
};

export function categoryTotalsQuery(
  api: Client<paths>,
  from: string,
  to: string,
  cls: CategoryClass,
) {
  return queryOptions({
    queryKey: categoryKeys.totals(from, to, cls),
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/reports/categories", {
            params: { query: { from, to, class: cls } },
          }),
        )
      ).items,
  });
}

function useAccountMutation<T>(
  request: (api: ReturnType<typeof useApi>, input: T) => Promise<unknown>,
  // A merge or an archive moves postings and closes descendants: every read can be stale.
  scope: "accounts" | "everything" = "accounts",
) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => request(api, input),
    onSuccess: () =>
      scope === "everything"
        ? queryClient.invalidateQueries()
        : Promise.all([
            queryClient.invalidateQueries({ queryKey: accountKeys.all }),
            queryClient.invalidateQueries({ queryKey: ["reports"] }),
          ]),
  });
}

export function useCreateCategory() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AccountInput) =>
      unwrap(await api.POST("/accounts", { body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export function useRenameCategory() {
  return useAccountMutation(
    async (api, { id, name }: { id: string; name: string }) =>
      unwrap(
        await api.PATCH("/accounts/{id}", {
          params: { path: { id } },
          body: { name },
        }),
      ),
  );
}

export function useMoveCategory() {
  return useAccountMutation(
    async (api, { id, parentId }: { id: string; parentId: string | null }) =>
      unwrap(
        await api.PUT("/accounts/{id}/parent", {
          params: { path: { id } },
          body: { parent_id: parentId },
        }),
      ),
  );
}

export function useCategoryAppearance() {
  return useAccountMutation(
    async (
      api,
      {
        id,
        color,
        icon,
      }: {
        id: string;
        color: number | null;
        icon: components["schemas"]["CategoryIcon"] | null;
      },
    ) =>
      unwrap(
        await api.PUT("/accounts/{id}/appearance", {
          params: { path: { id } },
          body: { color, icon },
        }),
      ),
  );
}

export function useMergeCategory() {
  return useAccountMutation(
    async (api, { id, into }: { id: string; into: string }) =>
      unwrap(
        await api.POST("/accounts/{id}/merge", {
          params: { path: { id } },
          body: { into },
        }),
      ),
    "everything",
  );
}

export function useArchiveCategory() {
  return useAccountMutation(
    async (api, { id, on }: { id: string; on: string }) =>
      unwrap(
        await api.POST("/accounts/{id}/close", {
          params: { path: { id } },
          body: { closed_on: on },
        }),
      ),
    "everything",
  );
}

export function useReopenCategory() {
  return useAccountMutation(
    async (api, id: string) =>
      unwrap(
        await api.POST("/accounts/{id}/reopen", { params: { path: { id } } }),
      ),
    "everything",
  );
}
