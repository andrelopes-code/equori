import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import { accountKeys } from "@/features/accounts";
import { transactionKeys } from "@/features/transactions";

const pageLimit = 200;

export const cardKeys = {
  statements: (a: string, from: string) =>
    [...accountKeys.detail(a), "statements", from] as const,
  statement: (a: string, s: string) =>
    [...accountKeys.detail(a), "statement", s] as const,
  billingRules: (a: string) =>
    [...accountKeys.detail(a), "billing-rules"] as const,
  creditLimits: (a: string) =>
    [...accountKeys.detail(a), "credit-limits"] as const,
  cards: (a: string) => [...accountKeys.detail(a), "cards"] as const,
  commitment: (a: string, month: string) =>
    [...accountKeys.detail(a), "commitment", month] as const,
  account: (a: string) => [...accountKeys.detail(a), "account"] as const,
  disputes: (t: string) => [...transactionKeys.detail(t), "disputes"] as const,
  plan: (p: string) => ["transactions", "plan", p] as const,
};

export function cardAccountQuery(api: Client<paths>, accountId: string) {
  return queryOptions({
    queryKey: cardKeys.account(accountId),
    queryFn: async () =>
      unwrap(
        await api.GET("/accounts/{id}", {
          params: { path: { id: accountId } },
        }),
      ),
  });
}

// Statements are listed by reference month ascending, so every page is read before the groups are computed.
export function statementsQuery(
  api: Client<paths>,
  accountId: string,
  from: string,
) {
  return queryOptions({
    queryKey: cardKeys.statements(accountId, from),
    queryFn: async () => {
      const items: components["schemas"]["StatementSummary"][] = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/accounts/{id}/statements", {
            params: {
              path: { id: accountId },
              query: {
                from,
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

export function statementQuery(
  api: Client<paths>,
  accountId: string,
  statementId: string,
) {
  return queryOptions({
    queryKey: cardKeys.statement(accountId, statementId),
    queryFn: async () =>
      unwrap(
        await api.GET("/statements/{id}", {
          params: { path: { id: statementId } },
        }),
      ),
  });
}

export function commitmentQuery(
  api: Client<paths>,
  accountId: string,
  month: string,
) {
  return queryOptions({
    queryKey: cardKeys.commitment(accountId, month),
    queryFn: async () =>
      unwrap(
        await api.GET("/accounts/{id}/commitments", {
          params: { path: { id: accountId }, query: { month } },
        }),
      ),
  });
}

export function billingRulesQuery(api: Client<paths>, accountId: string) {
  return queryOptions({
    queryKey: cardKeys.billingRules(accountId),
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/accounts/{id}/billing-cycle-rules", {
            params: { path: { id: accountId } },
          }),
        )
      ).items,
  });
}

export function creditLimitsQuery(api: Client<paths>, accountId: string) {
  return queryOptions({
    queryKey: cardKeys.creditLimits(accountId),
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/accounts/{id}/credit-limits", {
            params: { path: { id: accountId } },
          }),
        )
      ).items,
  });
}

export function cardsQuery(api: Client<paths>, accountId: string) {
  return queryOptions({
    queryKey: cardKeys.cards(accountId),
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/accounts/{id}/cards", {
            params: { path: { id: accountId } },
          }),
        )
      ).items,
  });
}

export function disputesQuery(api: Client<paths>, transactionId: string) {
  return queryOptions({
    queryKey: cardKeys.disputes(transactionId),
    queryFn: async () =>
      unwrap(
        await api.GET("/transactions/{id}/disputes", {
          params: { path: { id: transactionId } },
        }),
      ),
  });
}

export function planQuery(api: Client<paths>, planId: string) {
  return queryOptions({
    queryKey: cardKeys.plan(planId),
    queryFn: async () =>
      unwrap(
        await api.GET("/installment-plans/{id}", {
          params: { path: { id: planId } },
        }),
      ),
  });
}
