import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";

// On the page of an open account, the quick entry posts to that account by default.
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
