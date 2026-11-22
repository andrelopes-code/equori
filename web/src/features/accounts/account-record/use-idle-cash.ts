import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { idleCashCandidate } from "@/features/accounts/account-record/idle-cash";
import type { IdleCash } from "@/features/accounts/account-record/idle-cash";
import { accountsQuery, firstEntryQuery } from "@/features/accounts/api";
import { instrumentsQuery, settingsQuery } from "@/features/setup";

type Account = components["schemas"]["Account"];

// BC19: the cash account of the brokerage that has no entry, with the account that pays instead;
// null while the page loads and when the brokerage has none.
export function useIdleCash(account: Account): IdleCash | null {
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const settings = useQuery(settingsQuery(api));

  const base = settings.data?.base_currency;
  const candidate =
    accounts.data === undefined ||
    instruments.data === undefined ||
    base === undefined
      ? null
      : idleCashCandidate(account, accounts.data, instruments.data.items, base);

  const entries = useQuery({
    ...firstEntryQuery(api, candidate?.cash.id ?? ""),
    enabled: candidate !== null,
  });

  if (entries.data === undefined || entries.data.items.length > 0) return null;

  return candidate;
}
