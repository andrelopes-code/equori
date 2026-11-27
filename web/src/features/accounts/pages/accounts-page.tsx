import { PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { use, useDeferredValue, useEffect, useMemo } from "react";

import { RefreshButton } from "@/ui/feedback/refresh-button";
import { useRefresh } from "@/ui/feedback/use-refresh";
import { useApi } from "@/api/api-context";
import { AccountsHeaderSlots } from "@/features/accounts/accounts-header/accounts-header-slots";
import { HeaderSlot } from "@/features/accounts/accounts-header/header-slot";
import {
  accountsQuery,
  balancesQuery,
  connectionsListQuery,
} from "@/features/accounts/api";
import { sides } from "@/features/accounts/balance-sheet/balance-sheet";
import { SheetGroups } from "@/features/accounts/balance-sheet/sheet-groups";
import { BalanceSheetFigures } from "@/features/accounts/balance-sheet/balance-sheet-figures";
import {
  arrangeSheet,
  type GroupBy,
  type Order,
} from "@/features/accounts/balance-sheet/sheet-layout";
import { SheetBar } from "@/features/accounts/sheet-bar/sheet-bar";
import { PendingLinksAlert } from "@/features/accounts/sheet-states/pending-links-alert";
import { SheetEmpty } from "@/features/accounts/sheet-states/sheet-empty";
import { useDifferingAccounts } from "@/features/accounts/balance-sheet/use-differing-accounts";
import { useSheetPreference } from "@/features/accounts/balance-sheet/use-sheet-preference";
import { useValuedGroups } from "@/features/accounts/model/use-valued-groups";
import { institutionsQuery, settingsQuery, useScale } from "@/features/setup";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { HeaderAction } from "@/ui/navigation/header-action";
import { QueryError } from "@/ui/feedback/query-error";
import { useServed } from "@/ui/navigation/use-served";
import { useMoneyFormat } from "@/privacy/use-money-format";

const newAccount = { to: "/accounts/new" } as const;

export function AccountsPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const served = useServed();
  // The tables keep a measure of up to 62rem: a page under the desktop width lists rows.
  const search = useSearch({ from: "/_authed/accounts/" });
  const date = search.date ?? today;
  const basis = search.basis ?? "booked";
  const [preference, remember] = useSheetPreference();
  const group = search.group ?? preference.group;
  const order = search.order ?? preference.order;
  const beforeDate = shiftDate(date, -30);
  const shown = useDeferredValue({
    date,
    basis,
    closed: search.closed === true,
  });

  const accounts = useQuery(accountsQuery(api));
  const balances = useQuery(balancesQuery(api, shown.date, shown.basis));
  const before = useQuery(
    balancesQuery(api, shiftDate(shown.date, -30), shown.basis),
  );
  const settings = useQuery(settingsQuery(api));
  const institutions = useQuery(institutionsQuery(api));
  const connections = useQuery(connectionsListQuery(api));
  const scale = useScale();
  const base = settings.data?.base_currency;

  const groups = useValuedGroups({
    accounts: accounts.data,
    balances: balances.data,
    base,
    date: shown.date,
    basis: shown.basis,
    includeClosed: shown.closed,
  });
  const beforeGroups = useValuedGroups({
    accounts: accounts.data,
    balances: before.data,
    base,
    date: shiftDate(shown.date, -30),
    basis: shown.basis,
  });
  const previous = beforeGroups === undefined ? undefined : sides(beforeGroups);
  const now = groups === undefined ? undefined : sides(groups);
  const byInstitution = useMemo(
    () => new Map((institutions.data ?? []).map((i) => [i.id, i])),
    [institutions.data],
  );
  const differing = useDifferingAccounts(accounts.data, order === "attention");
  const sections = useMemo(
    () =>
      groups === undefined || base === undefined
        ? undefined
        : arrangeSheet({
            groups,
            by: group,
            order,
            locale,
            base,
            institutions: byInstitution,
            differing,
          }),
    [groups, base, group, order, locale, byInstitution, differing],
  );
  const pending = (connections.data?.items ?? []).reduce(
    (sum, c) => sum + c.accounts.filter((a) => a.state === "pending").length,
    0,
  );
  const failed = [accounts, balances, settings].find((q) => q.isError);
  const ready = groups !== undefined && scale !== null && base !== undefined;
  const busy = balances.isFetching || before.isFetching || shown.date !== date;

  const setSearch = (patch: {
    date?: string | undefined;
    basis?: "settled" | undefined;
    closed?: true | undefined;
    group?: GroupBy | undefined;
    order?: Order | undefined;
  }) => {
    void navigate({
      to: "/accounts",
      search: (prev) => {
        const next = { ...prev, ...patch };
        return Object.fromEntries(
          Object.entries(next).filter(([, v]) => v !== undefined),
        );
      },
      replace: true,
    });
  };

  const { setRefreshing } = use(AccountsHeaderSlots);
  const refresh = useRefresh(() =>
    Promise.all([balances.refetch(), before.refetch()]),
  );
  useEffect(() => {
    setRefreshing(refresh.refreshing);
    return () => {
      setRefreshing(false);
    };
  }, [setRefreshing, refresh.refreshing]);
  return (
    <>
      <HeaderSlot slot="subheading">
        {now === undefined || base === undefined || scale === null
          ? t("accounts.subtitle")
          : t("balanceSheet.subtitle", {
              amount: fmt.money(
                { amount: now.net, currency: base },
                scale(base),
              ),
              date: formatDate(date, locale),
            })}
      </HeaderSlot>
      <HeaderSlot slot="actions">
        <>
          <RefreshButton
            label={t("balanceSheet.refresh")}
            refreshing={refresh.refreshing}
            onRefresh={refresh.refresh}
          />
          {served(newAccount) && (
            <HeaderAction
              primary
              label={t("balanceSheet.new")}
              glyph="plus"
              onClick={() => {
                void navigate(newAccount);
              }}
            />
          )}
        </>
      </HeaderSlot>
      <PageBody>
        {failed !== undefined ? (
          <QueryError
            error={failed.error}
            onRetry={() => void failed.refetch()}
          />
        ) : ready && groups.length === 0 ? (
          <SheetEmpty />
        ) : (
          <Stack gap={6} aria-busy={busy || undefined}>
            <PendingLinksAlert pending={pending} />
            <BalanceSheetFigures
              now={now}
              before={previous}
              beforeDate={beforeDate}
              currency={base ?? ""}
              scale={base === undefined || scale === null ? 0 : scale(base)}
              loading={!ready}
            />
            <SheetBar
              date={date}
              basis={basis}
              closed={search.closed === true}
              group={group}
              order={order}
              onDateChange={(iso) => {
                setSearch({ date: iso === today ? undefined : iso });
              }}
              onBasisChange={(value) => {
                setSearch({ basis: value === "booked" ? undefined : value });
              }}
              onClosedChange={(checked) => {
                setSearch({ closed: checked ? true : undefined });
              }}
              onGroupChange={(value) => {
                setSearch({ group: value });
                remember({ group: value, order });
              }}
              onOrderChange={(value) => {
                setSearch({ order: value });
                remember({ group, order: value });
              }}
            />
            <SheetGroups
              sections={ready ? sections : undefined}
              institutions={byInstitution}
              showInstitution={group !== "institution"}
              date={shown.date}
              scale={scale}
            />
          </Stack>
        )}
      </PageBody>
    </>
  );
}
