import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import {
  accountsQuery,
  reconciliationQuery,
  unconfirmedQuery,
} from "@/features/accounts";
import { currentAndUnpaid, statementsQuery } from "@/features/cards";
import { categoryEntries } from "@/features/categories";
import { connectionsQuery } from "@/features/connections";
import { uncategorizedQuery } from "@/features/overview/api";
import { attentionItems } from "@/features/overview/attention/attention";
import type { AttentionItem } from "@/features/overview/attention/attention";
import { shiftMonth } from "@/features/overview/model/forecast";
import { useBase } from "@/features/overview/model/use-base";
import {
  budgetProgressQuery,
  budgetsQuery,
  startsBy,
} from "@/features/planning";
import { useAppLocale } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// Twelve months back hold every closed statement still owing in practice.
const lookBackMonths = 12;

export interface Attention {
  items: AttentionItem[];
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

// What waits for a decision, ranked by impact. Empty while loading and on error.
export function useAttention(): Attention {
  const api = useApi();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const today = useToday();
  const month = today.slice(0, 7);
  const accounts = useQuery(accountsQuery(api));
  const uncategorized = useQuery(uncategorizedQuery(api));
  const connections = useQuery(connectionsQuery(api));
  const budgets = useQuery(budgetsQuery(api));
  const all = accounts.data ?? [];
  // An account with sub-accounts holds no records: the API refuses its unconfirmed list.
  const parents = new Set(all.map((account) => account.parent_id));
  const open = all.filter(
    (account) =>
      (account.class === "asset" || account.class === "liability") &&
      account.closed_on === undefined &&
      !parents.has(account.id),
  );
  const unconfirmed = useQueries({
    queries: open.map((account) => unconfirmedQuery(api, account.id)),
  });
  const reconciliations = useQueries({
    queries: open.map((account) => reconciliationQuery(api, account.id)),
  });
  const cards = open.filter((account) => account.kind === "credit_card");
  const statements = useQueries({
    queries: cards.map((card) =>
      statementsQuery(api, card.id, shiftMonth(month, -lookBackMonths)),
    ),
  });
  const active = (budgets.data ?? []).filter((budget) =>
    startsBy(budget, month),
  );
  const progress = useQueries({
    queries: active.map((budget) => budgetProgressQuery(api, budget.id, month)),
  });
  const sources = [
    accounts,
    uncategorized,
    connections,
    budgets,
    ...unconfirmed,
    ...reconciliations,
    ...statements,
    ...progress,
  ];
  const error = sources.find((query) => query.error !== null)?.error ?? null;
  const loading =
    scale === null || sources.some((query) => query.data === undefined);
  const names = new Map(
    categoryEntries(all, locale).map((entry) => [entry.id, entry.name]),
  );

  return {
    items:
      loading || error !== null
        ? []
        : attentionItems({
            today,
            uncategorized: uncategorized.data?.count ?? 0,
            uncategorizedMore: uncategorized.data?.more === true,
            unconfirmed: open.map((account, i) => {
              // Entries come oldest first; a card's earliest one names the statement to open.
              const statementId = unconfirmed[i]?.data?.find(
                (entry) => entry.statement_id !== undefined,
              )?.statement_id;

              return {
                account,
                count: unconfirmed[i]?.data?.length ?? 0,
                ...(statementId === undefined ? {} : { statementId }),
              };
            }),
            connections: connections.data?.items ?? [],
            differences: open.map((account, i) => ({
              account,
              difference: reconciliations[i]?.data?.open_difference?.difference,
            })),
            statements: cards.map((account, i) => ({
              account,
              unpaid: currentAndUnpaid(statements[i]?.data ?? []).unpaid,
            })),
            budgets: active.flatMap((budget, i) => {
              const data = progress[i]?.data;

              return data === undefined
                ? []
                : [
                    {
                      id: budget.id,
                      name: names.get(budget.category_id) ?? "",
                      progress: data,
                    },
                  ];
            }),
          }),
    loading,
    error,
    retry: () => {
      for (const query of sources) {
        if (query.isError) void query.refetch();
      }
    },
  };
}
