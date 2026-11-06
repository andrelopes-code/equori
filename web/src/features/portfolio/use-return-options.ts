import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { accountLabel } from "@/features/portfolio/account-label";
import { returnAccounts } from "@/features/portfolio/return-accounts";
import { instrumentsQuery } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The option that measures every brokerage tree; an account id never equals it.
export const wholePortfolio = "portfolio";

// The accounts a return can measure, as select options: the whole portfolio first when the book
// has a brokerage.
export function useReturnOptions() {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const options = useMemo(() => {
    if (accounts.data === undefined || instruments.data === undefined)
      return [];
    const byID = new Map(accounts.data.map((a) => [a.id, a]));
    const currencies = new Set(
      instruments.data.items
        .filter((i) => i.type === "currency")
        .map((i) => i.code),
    );
    const list = returnAccounts(
      accounts.data,
      currencies,
      (a) => accountLabel(byID, a.id),
      tag,
    ).map((a) => ({ value: a.id, label: accountLabel(byID, a.id) }));
    return accounts.data.some((a) => a.kind === "brokerage")
      ? [{ value: wholePortfolio, label: t("portfolio.return.whole") }, ...list]
      : list;
  }, [accounts.data, instruments.data, tag, t]);
  const loaded = accounts.data !== undefined && instruments.data !== undefined;

  return { accounts, options, loaded };
}
