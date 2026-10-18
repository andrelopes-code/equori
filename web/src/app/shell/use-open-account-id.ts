import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";

// On the page of an open account, "New" opens the form with that account preselected.
export function useOpenAccountID(): string | undefined {
  const routeAccountID = useRouterState({
    select: (s) => /^\/accounts\/([^/]+)$/.exec(s.location.pathname)?.[1],
  });
  const accountList = useQuery({
    ...accountsQuery(useApi()),
    enabled: routeAccountID !== undefined,
  });
  return accountList.data?.find(
    (a) => a.id === routeAccountID && a.closed_on === undefined,
  )?.id;
}

export function newTransactionHref(accountID: string | undefined): string {
  return accountID === undefined
    ? "/transactions/new"
    : `/transactions/new?account_id=${accountID}`;
}
