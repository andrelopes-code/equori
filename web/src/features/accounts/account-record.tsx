import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { AccountDialogs } from "@/features/accounts/account-dialogs";
import type { AccountDialog } from "@/features/accounts/account-dialogs";
import { AccountFigures } from "@/features/accounts/account-figures";
import { AccountHeader } from "@/features/accounts/account-header";
import { lineage } from "@/features/accounts/account-lineage";
import { withRange } from "@/features/accounts/account-search";
import type { AccountSearch, Range } from "@/features/accounts/account-search";
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
import { useAccountTabs } from "@/features/accounts/use-account-tabs";
import { institutionsQuery } from "@/features/setup";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";
import { useStableCallback } from "@/ui/use-stable-callback";

type Account = components["schemas"]["Account"];

interface AccountRecordProps {
  account: Account;
  search: AccountSearch;
  scale: (code: string) => number;
}

export function AccountRecord({ account, search, scale }: AccountRecordProps) {
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
  const [dialog, setDialog] = useState<AccountDialog | null>(null);

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

  const accountTabs = useAccountTabs({
    accountId: account.id,
    search,
    leaf,
    brokerage: isBrokerage,
    linked: linked !== undefined,
    reconciliationCount:
      reconciliation.data === undefined || unconfirmed.data === undefined
        ? undefined
        : (reconciliation.data.open_difference === undefined ? 0 : 1) +
          unconfirmed.data.length,
    importCount: imports.data?.length,
  });
  const range: Range = search.range ?? 90;
  const changeRange = useStableCallback((next: Range) => {
    void navigate({
      to: "/accounts/$id",
      params: { id: account.id },
      search: withRange(search, next),
      replace: true,
    });
  });

  // A phone reads the records under the tabs first, and the figures after them (mobile.md M2, M4).
  // The figures belong to the activity tab: under another tab they would push its content below the fold.
  const compact = useMediaQuery(compactQuery);
  const overview = accountTabs.shownTab === "activity" && (
    <>
      <AccountFigures account={account} scale={scale} />
      <BalanceChart
        account={account}
        range={range}
        onRange={changeRange}
        scale={scale(account.currency)}
      />
    </>
  );
  return (
    <Page width="full">
      <AccountHeader
        account={account}
        institution={institution}
        external={linked?.external}
        tabs={accountTabs.tabs}
        current={accountTabs.marked}
        onTab={accountTabs.select}
        onClose={() => {
          setDialog("close");
        }}
        onReopen={() => {
          setDialog("reopen");
        }}
        onUnlock={() => {
          setDialog("unlock");
        }}
        refreshing={accountTabs.refreshing}
        scale={scale}
      />
      <PageBody>
        <Stack gap={6}>
          <AccountSetupMessage accountId={account.id} />
          {!compact && overview}
          <div aria-busy={accountTabs.refreshing || undefined}>
            <AccountTabPanel
              tab={accountTabs.shownTab}
              account={account}
              search={search}
              linked={linked}
              descendants={
                accounts.data === undefined ? undefined : descendants
              }
              scale={scale}
            />
          </div>
          {compact && overview}
        </Stack>
      </PageBody>
      <AccountDialogs
        dialog={dialog}
        account={account}
        ancestors={ancestors}
        descendants={descendants}
        lastReconciled={reconciliation.data?.last_reconciled_on}
        scale={scale}
        onDismiss={() => {
          setDialog(null);
        }}
      />
    </Page>
  );
}
