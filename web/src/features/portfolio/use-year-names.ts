import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { instrumentsQuery } from "@/features/setup";

// What the tables of the year name a row by: an instrument's name, and the account at the top of
// a tree. A security's own account says no more than the investment beside it.
export function useYearNames() {
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));

  const byID = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const names = new Map(
    (instruments.data?.items ?? []).map((i) => [i.code, i.name]),
  );

  function holder(id: string) {
    const account = byID.get(id);

    return account?.parent_id === undefined
      ? account
      : (byID.get(account.parent_id) ?? account);
  }

  function instrumentName(code: string) {
    return names.get(code) ?? code;
  }

  return {
    holder,
    instrumentName,
    pending: accounts.isPending || instruments.isPending,
  };
}
