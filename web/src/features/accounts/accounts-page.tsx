import { parseISODate, toISODate } from "@slotted/core/date";
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { DatePicker } from "@slotted/react/date-picker";
import { Inline } from "@slotted/react/inline";
import { PageBody } from "@slotted/react/page";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { Switch } from "@slotted/react/switch";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { use, useDeferredValue, useEffect, useMemo } from "react";

import { RefreshButton } from "@/ui/refresh-button";
import { useRefresh } from "@/ui/use-refresh";
import { useApi } from "@/api/api-context";
import { AccountsHeaderSlots } from "@/features/accounts/accounts-header-slots";
import { HeaderSlot } from "@/features/accounts/header-slot";
import {
  accountsQuery,
  balancesQuery,
  connectionsListQuery,
} from "@/features/accounts/api";
import { BalanceGroupList } from "@/features/accounts/balance-group-list";
import { BalanceGroupTable } from "@/features/accounts/balance-group-table";
import { groupBalances, groupLabels } from "@/features/accounts/balance-groups";
import { sheetRows, sides } from "@/features/accounts/balance-sheet";
import styles from "@/features/accounts/balance-sheet.module.css";
import { BalanceSheetFigures } from "@/features/accounts/balance-sheet-figures";
import { institutionsQuery, settingsQuery, useScale } from "@/features/setup";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { HeaderAction } from "@/ui/header-action";
import { QueryError } from "@/ui/query-error";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";
import { useMoneyFormat } from "@/privacy/use-money-format";

export function AccountsPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const compact = useMediaQuery(compactQuery);
  const search = useSearch({ from: "/_authed/accounts/" });
  const date = search.date ?? today;
  const basis = search.basis ?? "booked";
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

  const groups = useMemo(
    () =>
      accounts.data === undefined ||
      balances.data === undefined ||
      base === undefined
        ? undefined
        : groupBalances(accounts.data, balances.data, base, shown.closed),
    [accounts.data, balances.data, base, shown.closed],
  );
  const previous = useMemo(
    () =>
      accounts.data === undefined ||
      before.data === undefined ||
      base === undefined
        ? undefined
        : sides(groupBalances(accounts.data, before.data, base)),
    [accounts.data, before.data, base],
  );
  const now = groups === undefined ? undefined : sides(groups);
  const byInstitution = new Map(
    (institutions.data ?? []).map((i) => [i.id, i]),
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
          <HeaderAction
            primary
            label={t("balanceSheet.new")}
            glyph="plus"
            onClick={() => {
              void navigate({ to: "/accounts/new" });
            }}
          />
        </>
      </HeaderSlot>
      <PageBody>
        {failed !== undefined ? (
          <QueryError
            error={failed.error}
            onRetry={() => void failed.refetch()}
          />
        ) : ready && groups.length === 0 ? (
          <ResultState status="empty" reach="section">
            <ResultStateContent>
              <ResultStateTitle>{t("balanceSheet.empty")}</ResultStateTitle>
              <ResultStateDescription>
                {t("balanceSheet.emptyHint")}
              </ResultStateDescription>
            </ResultStateContent>
            <ResultStateActions>
              <Button
                onClick={() => {
                  void navigate({ to: "/accounts/new" });
                }}
              >
                {t("balanceSheet.new")}
              </Button>
            </ResultStateActions>
          </ResultState>
        ) : (
          <Stack gap={6} aria-busy={busy || undefined}>
            {pending > 0 && (
              <Alert tone="accent">
                <AlertContent>
                  <AlertDescription>
                    {t("balanceSheet.pendingLinks", { count: pending })}
                  </AlertDescription>
                </AlertContent>
                <AlertActions>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigate({ to: "/accounts/links" });
                    }}
                  >
                    {t("balanceSheet.reviewLinks")}
                  </Button>
                </AlertActions>
              </Alert>
            )}
            <BalanceSheetFigures
              now={now}
              before={previous}
              beforeDate={beforeDate}
              currency={base ?? ""}
              scale={base === undefined || scale === null ? 0 : scale(base)}
              loading={!ready}
            />
            {/* The date and the basis the whole sheet is read at, with the closed accounts. */}
            <div className={styles.bar}>
              <Inline gap={3}>
                <div className={styles.date}>
                  <DatePicker
                    aria-label={t("balanceSheet.date")}
                    value={parseISODate(date)}
                    onValueChange={(value) => {
                      if (
                        value !== null &&
                        !Array.isArray(value) &&
                        "year" in value
                      ) {
                        const iso = toISODate(value);
                        setSearch({ date: iso === today ? undefined : iso });
                      }
                    }}
                  />
                </div>
                <SegmentedControl
                  aria-label={t("balanceSheet.basis")}
                  value={basis}
                  onValueChange={(value) => {
                    if (value === "booked" || value === "settled") {
                      setSearch({
                        basis: value === "booked" ? undefined : value,
                      });
                    }
                  }}
                >
                  <Segment value="booked">{t("balanceSheet.booked")}</Segment>
                  <Segment value="settled">{t("balanceSheet.settled")}</Segment>
                </SegmentedControl>
              </Inline>
              <Switch
                checked={search.closed === true}
                onCheckedChange={(checked) => {
                  setSearch({ closed: checked ? true : undefined });
                }}
              >
                {t("balanceSheet.showClosed")}
              </Switch>
            </div>
            {ready && (
              <div className={styles.groups}>
                {groups.map((group) => {
                  const props = {
                    label: t(groupLabels[group.group]),
                    rows: sheetRows(group, locale),
                    total: group.total,
                    excluded: group.excluded,
                    institutions: byInstitution,
                    scale,
                  };
                  return compact ? (
                    <BalanceGroupList key={group.group} {...props} />
                  ) : (
                    <BalanceGroupTable
                      key={group.group}
                      {...props}
                      date={shown.date}
                    />
                  );
                })}
              </div>
            )}
          </Stack>
        )}
      </PageBody>
    </>
  );
}
