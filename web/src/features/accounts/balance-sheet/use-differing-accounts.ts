import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { reconciliationQuery } from "@/features/accounts/api";

type Account = components["schemas"]["Account"];

// The accounts with an open reconciliation difference. The reads run only while the list is
// ordered by attention (AL6); a parent holds no statement of its own and a credit card agrees
// statement by statement, so neither is read. The queries are those of the row status.
export function useDifferingAccounts(
  accounts: readonly Account[] | undefined,
  enabled: boolean,
): ReadonlySet<string> {
  const api = useApi();
  const all = accounts ?? [];
  const parents = new Set(all.map((account) => account.parent_id));
  const leaves = all.filter(
    (account) => account.kind !== "credit_card" && !parents.has(account.id),
  );
  const key = useQueries({
    queries: leaves.map((account) => ({
      ...reconciliationQuery(api, account.id),
      enabled,
    })),
    combine: (results) =>
      leaves
        .filter((_, i) => results[i]?.data?.open_difference !== undefined)
        .map((account) => account.id)
        .join(","),
  });

  return useMemo(() => new Set(key === "" ? [] : key.split(",")), [key]);
}
