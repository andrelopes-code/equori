import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { AccountFigures } from "@/features/accounts/account-figures";
import { AccountHeader } from "@/features/accounts/account-header";
import type { TabEntry } from "@/features/accounts/account-header";
import { withRange, withTab } from "@/features/accounts/account-search";
import type {
  AccountSearch,
  AccountTab,
  Range,
} from "@/features/accounts/account-search";
import { AccountSetupMessage } from "@/features/accounts/account-setup-message";
import { AccountTabPanel } from "@/features/accounts/account-tab-panel";
import {
  accountsQuery,
  connectionsListQuery,
  importBatchesQuery,
  reconciliationQuery,
  unconfirmedQuery,
} from "@/features/accounts/api";
import { BalanceChart } from "@/features/accounts/balance-chart";
import { CloseAccountDialog } from "@/features/accounts/close-account-dialog";
import { ReopenAccountDialog } from "@/features/accounts/reopen-account-dialog";
import { UnlockDialog } from "@/features/accounts/unlock-dialog";
import { institutionsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";
import { Presence } from "@/ui/presence";

type Account = components["schemas"]["Account"];

function lineage(account: Account, accounts: Account[]) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const ancestors: Account[] = [];
  for (let p = account.parent_id; p !== undefined; p = byId.get(p)?.parent_id) {
    const parent = byId.get(p);
    if (parent === undefined) break;
    ancestors.push(parent);
  }
  const descendants: Account[] = [];
  const queue = [account.id];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const child of accounts.filter((a) => a.parent_id === id)) {
      descendants.push(child);
      queue.push(child.id);
    }
  }
  return { ancestors, descendants };
}

export function AccountRecord({
  account,
  search,
  scale,
}: {
  account: Account;
  search: AccountSearch;
  scale: (code: string) => number;
}) {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const accounts = useQuery(accountsQuery(api));
  const institutions = useQuery(institutionsQuery(api));
  const connections = useQuery(connectionsListQuery(api));
  // Assertions are for leaf balance accounts: a parent agrees through its sub-accounts.
  const parentAccount = (accounts.data ?? []).some(
    (a) => a.parent_id === account.id,
  );
  const leaf =
    (account.class === "asset" || account.class === "liability") &&
    !parentAccount;
  const reconciliation = useQuery({
    ...reconciliationQuery(api, account.id),
    enabled: leaf,
  });
  const unconfirmed = useQuery({
    ...unconfirmedQuery(api, account.id),
    enabled: leaf,
  });
  const imports = useQuery(importBatchesQuery(api, account.id));
  const [dialog, setDialog] = useState<"close" | "reopen" | "unlock" | null>(
    null,
  );

  const institution = institutions.data?.find(
    (i) => i.id === account.institution_id,
  );
  const linked = (connections.data?.items ?? []).flatMap((c) =>
    c.accounts
      .filter((a) => a.account_id === account.id && a.state === "mapped")
      .map((external) => ({ connection: c, external })),
  )[0];
  const { ancestors, descendants } = lineage(account, accounts.data ?? []);
  const isBrokerage =
    account.kind === "brokerage" && account.parent_id === undefined;

  const current: AccountTab = search.tab ?? "activity";
  // CP-09: the strip moves at once; the tab's region renders from the deferred value.
  const [chosen, setChosen] = useState<AccountTab | null>(null);
  const shownTab = useDeferredValue(chosen ?? current);
  const count = (n: number | undefined) =>
    n === undefined ? "" : ` (${String(n)})`;
  const reconciliationCount =
    reconciliation.data === undefined || unconfirmed.data === undefined
      ? undefined
      : (reconciliation.data.open_difference === undefined ? 0 : 1) +
        unconfirmed.data.length;
  const tabs: TabEntry[] = [
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
      label: t("account.tab.imports") + count(imports.data?.length),
    },
    { tab: "scheduled", label: t("account.tab.scheduled") },
    ...(isBrokerage
      ? [{ tab: "positions" as const, label: t("account.tab.positions") }]
      : []),
    ...(linked === undefined
      ? []
      : [{ tab: "sync" as const, label: t("account.tab.sync") }]),
  ];
  const range: Range = search.range ?? 90;
  const changeRange = useStableCallback((next: Range) => {
    void navigate({
      to: "/accounts/$id",
      params: { id: account.id },
      search: withRange(search, next),
      replace: true,
    });
  });

  return (
    <Page width="full">
      <AccountHeader
        account={account}
        institution={institution}
        external={linked?.external}
        tabs={tabs}
        current={chosen ?? current}
        onTab={(tab) => {
          setChosen(tab);
          void navigate({
            to: "/accounts/$id",
            params: { id: account.id },
            search: withTab(search, tab),
            replace: true,
          }).then(() => {
            setChosen(null);
          });
        }}
        onClose={() => {
          setDialog("close");
        }}
        onReopen={() => {
          setDialog("reopen");
        }}
        onUnlock={() => {
          setDialog("unlock");
        }}
        refreshing={shownTab !== (chosen ?? current)}
        scale={scale}
      />
      <PageBody>
        <Stack gap={6}>
          <AccountSetupMessage accountId={account.id} />
          <AccountFigures account={account} scale={scale} />
          <BalanceChart
            account={account}
            range={range}
            onRange={changeRange}
            scale={scale(account.currency)}
          />
          <div aria-busy={shownTab !== (chosen ?? current) || undefined}>
            <AccountTabPanel
              tab={shownTab}
              account={account}
              search={search}
              linked={linked}
              descendants={
                accounts.data === undefined ? undefined : descendants
              }
              scale={scale}
            />
          </div>
        </Stack>
      </PageBody>
      <Presence value={dialog === "close" ? dialog : undefined}>
        {() => (
          <CloseAccountDialog
            account={account}
            descendants={descendants}
            scale={scale}
            onCancel={() => {
              setDialog(null);
            }}
            onDone={() => {
              setDialog(null);
              toast.show({
                tone: "success",
                title: t("account.closed", { name: account.name }),
              });
            }}
          />
        )}
      </Presence>
      <Presence value={dialog === "reopen" ? dialog : undefined}>
        {() => (
          <ReopenAccountDialog
            account={account}
            ancestors={ancestors}
            onCancel={() => {
              setDialog(null);
            }}
            onDone={() => {
              setDialog(null);
              toast.show({
                tone: "success",
                title: t("account.reopened", { name: account.name }),
              });
            }}
          />
        )}
      </Presence>
      <Presence value={dialog === "unlock" ? dialog : undefined}>
        {() => (
          <UnlockDialog
            account={account}
            lastReconciled={reconciliation.data?.last_reconciled_on}
            onCancel={() => {
              setDialog(null);
            }}
            onDone={() => {
              setDialog(null);
              toast.show({ tone: "success", title: t("unlock.done") });
            }}
          />
        )}
      </Presence>
    </Page>
  );
}
