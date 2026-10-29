import { useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";

import type { TabEntry } from "@/features/accounts/account-header";
import { phoneAccountTabs, withTab } from "@/features/accounts/account-search";
import type {
  AccountSearch,
  AccountTab,
} from "@/features/accounts/account-search";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

interface AccountTabsInput {
  accountId: string;
  search: AccountSearch;
  leaf: boolean;
  brokerage: boolean;
  linked: boolean;
  reconciliationCount: number | undefined;
  importCount: number | undefined;
}

// The tabs of an account's page, the one the strip marks and the one its region renders.
export function useAccountTabs({
  accountId,
  search,
  leaf,
  brokerage,
  linked,
  reconciliationCount,
  importCount,
}: AccountTabsInput) {
  const t = useT();
  const navigate = useNavigate();
  const compact = useMediaQuery(compactQuery);

  const asked: AccountTab = search.tab ?? "activity";
  const current: AccountTab =
    compact && !phoneAccountTabs.includes(asked) ? "activity" : asked;
  // CP-09: the strip moves at once; the tab's region renders from the deferred value.
  const [chosen, setChosen] = useState<AccountTab | null>(null);
  const shownTab = useDeferredValue(chosen ?? current);

  const marked = chosen ?? current;
  const every: TabEntry[] = [
    { tab: "activity", label: t("account.tab.activity") },
    ...(leaf
      ? [
          {
            tab: "reconciliation" as const,
            label: t("account.tab.reconciliation") + count(reconciliationCount),
          },
        ]
      : []),
    {
      tab: "imports",
      label: t("account.tab.imports") + count(importCount),
    },
    { tab: "scheduled", label: t("account.tab.scheduled") },
    ...(brokerage
      ? [{ tab: "positions" as const, label: t("account.tab.positions") }]
      : []),
    ...(linked ? [{ tab: "sync" as const, label: t("account.tab.sync") }] : []),
  ];
  const tabs = compact
    ? every.filter((entry) => phoneAccountTabs.includes(entry.tab))
    : every;

  function select(tab: AccountTab) {
    setChosen(tab);
    void navigate({
      to: "/accounts/$id",
      params: { id: accountId },
      search: withTab(search, tab),
      replace: true,
    }).then(() => {
      setChosen(null);
    });
  }

  return {
    tabs,
    marked,
    shownTab,
    refreshing: shownTab !== marked,
    select,
  };
}

function count(n: number | undefined): string {
  return n === undefined ? "" : ` (${String(n)})`;
}
