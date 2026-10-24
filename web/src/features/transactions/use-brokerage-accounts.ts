import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { instrumentsQuery, settingsQuery } from "@/features/setup";

type Account = components["schemas"]["Account"];

// The accounts a trade or an income may name (A68, A70): the account that holds a security, and
// the cash accounts of its brokerage in the base currency.
export function useBrokerageAccounts(
  accountId: string | null,
  cashId: string | null,
) {
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const securities = useMemo(() => {
    const types = new Map(
      (instruments.data?.items ?? []).map((i) => [i.code, i.type]),
    );
    const all = accounts.data ?? [];
    const parents = new Set(all.map((a) => a.parent_id));
    return all.filter(
      (a) =>
        a.closed_on === undefined &&
        !parents.has(a.id) &&
        types.has(a.currency) &&
        types.get(a.currency) !== "currency",
    );
  }, [accounts.data, instruments.data]);
  const security: Account | undefined =
    securities.find((a) => a.id === accountId) ??
    (accountId === null && securities.length === 1 ? securities[0] : undefined);
  const cashChoices = useMemo(
    () =>
      security?.parent_id === undefined
        ? []
        : (accounts.data ?? []).filter(
            (a) =>
              a.parent_id === security.parent_id &&
              a.class === "asset" &&
              a.currency === base &&
              a.closed_on === undefined,
          ),
    [accounts.data, security, base],
  );
  // One cash account leaves nothing to choose.
  const cashAccountId = cashChoices.some((a) => a.id === cashId)
    ? cashId
    : cashChoices.length === 1
      ? (cashChoices[0]?.id ?? null)
      : null;
  return { securities, security, cashChoices, cashAccountId };
}
