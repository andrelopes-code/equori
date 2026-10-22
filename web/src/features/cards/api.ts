import { queryOptions, useMutation } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
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

// A119: the account's booked inflow and outflow per day in [from, to].
export function flowsQuery(
  api: Client<paths>,
  accountId: string,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: [...accountKeys.detail(accountId), "flows", from, to] as const,
    queryFn: async () => {
      const flows = await unwrap(
        await api.GET("/reports/flows", {
          params: { query: { account_id: accountId, from, to } },
        }),
      );
      return flows.items;
    },
  });
}

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

export function placementQuery(
  api: Client<paths>,
  accountId: string,
  date: string,
) {
  return queryOptions({
    queryKey: [...accountKeys.detail(accountId), "placement", date] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/accounts/{id}/statement-placement", {
          params: { path: { id: accountId }, query: { date } },
        }),
      ),
    retry: false,
  });
}

function useApiMutation<V, R>(fn: (api: Client<paths>, vars: V) => Promise<R>) {
  const api = useApi();
  return useMutation({ mutationFn: (vars: V) => fn(api, vars) });
}

export function useCreateCard() {
  return useApiMutation(
    async (
      api,
      {
        accountId,
        card,
      }: { accountId: string; card: components["schemas"]["CardInput"] },
    ) =>
      unwrap(
        await api.POST("/accounts/{id}/cards", {
          params: { path: { id: accountId } },
          body: card,
        }),
      ),
  );
}

export function useUpdateCard() {
  return useApiMutation(
    async (api, { id, active }: { id: string; active: boolean }) =>
      unwrap(
        await api.PATCH("/cards/{id}", {
          params: { path: { id } },
          body: { active },
        }),
      ),
  );
}

export function useCreateBillingRule() {
  return useApiMutation(
    async (
      api,
      {
        accountId,
        rule,
      }: { accountId: string; rule: components["schemas"]["BillingCycleRule"] },
    ) =>
      unwrap(
        await api.POST("/accounts/{id}/billing-cycle-rules", {
          params: { path: { id: accountId } },
          body: rule,
        }),
      ),
  );
}

export function useCreateCreditLimit() {
  return useApiMutation(
    async (
      api,
      {
        accountId,
        limit,
      }: { accountId: string; limit: components["schemas"]["CreditLimit"] },
    ) =>
      unwrap(
        await api.POST("/accounts/{id}/credit-limits", {
          params: { path: { id: accountId } },
          body: limit,
        }),
      ),
  );
}

export function useCreateInstallmentPurchase() {
  return useApiMutation(
    async (api, body: components["schemas"]["InstallmentPurchaseInput"]) =>
      unwrap(await api.POST("/installment-purchases", { body })),
  );
}

export function usePayStatement() {
  return useApiMutation(
    async (
      api,
      {
        id,
        body,
      }: { id: string; body: components["schemas"]["StatementPaymentInput"] },
    ) =>
      unwrap(
        await api.POST("/statements/{id}/payments", {
          params: { path: { id } },
          body,
        }),
      ),
  );
}

export function useFinanceStatement() {
  return useApiMutation(
    async (
      api,
      {
        id,
        body,
      }: { id: string; body: components["schemas"]["StatementFinancingInput"] },
    ) =>
      unwrap(
        await api.POST("/statements/{id}/financing", {
          params: { path: { id } },
          body,
        }),
      ),
  );
}

export function useReconcileStatement() {
  return useApiMutation(
    async (
      api,
      {
        id,
        amountDue,
      }: { id: string; amountDue: components["schemas"]["Money"] },
    ) =>
      unwrap(
        await api.POST("/statements/{id}/reconcile", {
          params: { path: { id } },
          body: { amount_due: amountDue },
        }),
      ),
  );
}

export function useSetStatementFacts() {
  return useApiMutation(
    async (
      api,
      {
        id,
        body,
      }: { id: string; body: components["schemas"]["StatementFactsInput"] },
    ) =>
      unwrap(
        await api.PUT("/statements/{id}/facts", {
          params: { path: { id } },
          body,
        }),
      ),
  );
}

export function useRemoveStatementFacts() {
  return useApiMutation(async (api, id: string) => {
    const result = await api.DELETE("/statements/{id}/facts", {
      params: { path: { id } },
    });
    if (result.error !== undefined) await unwrap(result);
  });
}

export function useRefund() {
  return useApiMutation(
    async (
      api,
      {
        transactionId,
        body,
      }: { transactionId: string; body: components["schemas"]["RefundInput"] },
    ) =>
      unwrap(
        await api.POST("/transactions/{id}/refunds", {
          params: { path: { id: transactionId } },
          body,
        }),
      ),
  );
}

export function useOpenDispute() {
  return useApiMutation(
    async (
      api,
      { transactionId, openedOn }: { transactionId: string; openedOn: string },
    ) =>
      unwrap(
        await api.POST("/transactions/{id}/disputes", {
          params: { path: { id: transactionId } },
          body: { opened_on: openedOn },
        }),
      ),
  );
}

export function useResolveDispute() {
  return useApiMutation(
    async (
      api,
      {
        id,
        body,
      }: { id: string; body: components["schemas"]["DisputeResolution"] },
    ) =>
      unwrap(
        await api.POST("/disputes/{id}/resolve", {
          params: { path: { id } },
          body,
        }),
      ),
  );
}

export function useCancelPlan() {
  return useApiMutation(
    async (
      api,
      {
        id,
        body,
      }: { id: string; body: components["schemas"]["CancellationInput"] },
    ) =>
      unwrap(
        await api.POST("/installment-plans/{id}/cancellation", {
          params: { path: { id } },
          body,
        }),
      ),
  );
}

export function useAnticipate() {
  return useApiMutation(
    async (
      api,
      {
        id,
        body,
      }: { id: string; body: components["schemas"]["AnticipationInput"] },
    ) =>
      unwrap(
        await api.POST("/installment-plans/{id}/anticipation", {
          params: { path: { id } },
          body,
        }),
      ),
  );
}
