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

type Rule = components["schemas"]["Rule"];
type RuleInput = components["schemas"]["RuleInput"];

export const ruleKeys = {
  all: ["rules"] as const,
  list: ["rules", "list"] as const,
  suggestions: ["rules", "suggestions"] as const,
  statistics: (from: string, to: string) =>
    ["rules", "statistics", from, to] as const,
  sources: ["rules", "sources"] as const,
};

const pageLimit = 200;

// Every rule in priority order, following the cursor.
export function rulesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ruleKeys.list,
    queryFn: async () => {
      const items: Rule[] = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/rules", {
            params: {
              query: {
                limit: pageLimit,
                ...(cursor === undefined ? {} : { cursor }),
              },
            },
          }),
        );
        items.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor !== undefined);
      return items;
    },
  });
}

export function pendingSuggestionsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ruleKeys.suggestions,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/rule-suggestions", {
            params: { query: { state: "pending", limit: pageLimit } },
          }),
        )
      ).items,
  });
}

export function statisticsQuery(api: Client<paths>, from: string, to: string) {
  return queryOptions({
    queryKey: ruleKeys.statistics(from, to),
    queryFn: async () =>
      unwrap(
        await api.GET("/categorization-statistics", {
          params: { query: { from, to } },
        }),
      ),
  });
}

export function sourceCategoriesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ruleKeys.sources,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/source-categories", {
            params: { query: { limit: pageLimit } },
          }),
        )
      ).items,
  });
}

// A rule changes what the next run decides; the rules and the statistics are read again.
function useRuleMutation<T, R>(
  request: (api: Client<paths>, input: T) => Promise<R>,
) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => request(api, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ruleKeys.all }),
  });
}

export function useCreateRule() {
  return useRuleMutation(async (api, body: RuleInput) =>
    unwrap(await api.POST("/rules", { body })),
  );
}

export function useReplaceRule() {
  return useRuleMutation(
    async (api, { id, body }: { id: string; body: RuleInput }) =>
      unwrap(await api.PUT("/rules/{id}", { params: { path: { id } }, body })),
  );
}

export function useDeleteRule() {
  return useRuleMutation(async (api, id: string) =>
    unwrap(await api.DELETE("/rules/{id}", { params: { path: { id } } })),
  );
}

export function useReorderRules() {
  return useRuleMutation(async (api, ids: string[]) =>
    unwrap(await api.POST("/rules/reorder", { body: { rule_ids: ids } })),
  );
}

export function useAcceptSuggestion() {
  return useRuleMutation(
    async (api, { id, name }: { id: string; name: string }) =>
      unwrap(
        await api.POST("/rule-suggestions/{id}/accept", {
          params: { path: { id } },
          body: { name },
        }),
      ),
  );
}

export function useDismissSuggestion() {
  return useRuleMutation(async (api, id: string) =>
    unwrap(
      await api.POST("/rule-suggestions/{id}/dismiss", {
        params: { path: { id } },
      }),
    ),
  );
}

export function useMapSourceCategory() {
  return useRuleMutation(
    async (
      api,
      { id, categoryId }: { id: string; categoryId: string | null },
    ) =>
      unwrap(
        await api.PUT("/source-categories/{id}", {
          params: { path: { id } },
          body: { category_id: categoryId },
        }),
      ),
  );
}

// Running the rules categorizes transactions: every read can be stale.
export function useRunRules() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/rules/run")),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function rulePreview(api: Client<paths>, body: RuleInput) {
  return api.POST("/rules/preview", { body });
}

type PayeeAlias = components["schemas"]["PayeeAlias"];
type PayeeAliasInput = components["schemas"]["PayeeAliasInput"];

export const aliasKeys = { all: ["payee-aliases"] as const };

// Every alias, oldest first, following the cursor.
export function payeeAliasesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: aliasKeys.all,
    queryFn: async () => {
      const items: PayeeAlias[] = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/payee-aliases", {
            params: {
              query: {
                limit: pageLimit,
                ...(cursor === undefined ? {} : { cursor }),
              },
            },
          }),
        );
        items.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor !== undefined);
      return items;
    },
  });
}

function useAliasMutation<T, R>(
  request: (api: Client<paths>, input: T) => Promise<R>,
) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => request(api, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aliasKeys.all }),
  });
}

export function useCreateAlias() {
  return useAliasMutation(async (api, body: PayeeAliasInput) =>
    unwrap(await api.POST("/payee-aliases", { body })),
  );
}

export function useReplaceAlias() {
  return useAliasMutation(
    async (api, { id, body }: { id: string; body: PayeeAliasInput }) =>
      unwrap(
        await api.PUT("/payee-aliases/{id}", {
          params: { path: { id } },
          body,
        }),
      ),
  );
}

export function useDeleteAlias() {
  return useAliasMutation(async (api, id: string) =>
    unwrap(
      await api.DELETE("/payee-aliases/{id}", { params: { path: { id } } }),
    ),
  );
}

// A renamed payee reads anew in every list that names it.
export function useRenamePayee() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      unwrap(
        await api.PATCH("/payees/{id}", {
          params: { path: { id } },
          body: { name },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useCreatePayeeRecord() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      unwrap(await api.POST("/payees", { body: { name } })),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

// A82: the source's transactions get a version naming the destination; aliases follow it.
export function useMergePayees() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sources,
      into,
    }: {
      sources: string[];
      into: string;
    }) => {
      for (const id of sources) {
        await unwrap(
          await api.POST("/payees/{id}/merge", {
            params: { path: { id } },
            body: { into },
          }),
        );
      }
    },
    onSettled: () => queryClient.invalidateQueries(),
  });
}
