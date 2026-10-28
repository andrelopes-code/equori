import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import styles from "@/features/planning/subscriptions-tab.module.css";
import { schedulesQuery } from "@/features/planning/api";
import { SubscriptionsList } from "@/features/planning/subscriptions-list";
import { ScheduleActions } from "@/features/planning/schedule-actions";
import {
  currentTerms,
  subscriptionCost,
} from "@/features/planning/schedule-words";
import { settingsQuery, useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";
import { QueryError } from "@/ui/query-error";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// The subscriptions: what each costs a month and a year at the price in force, and how its price
// moved from one terms version to the next.
export function SubscriptionsTab() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const compact = useMediaQuery(compactQuery);
  const schedules = useQuery(schedulesQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const names = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  const rows = (schedules.data ?? [])
    .filter((s) => s.kind === "subscription")
    .flatMap((schedule) => {
      const terms = currentTerms(schedule.terms, today);
      return terms === undefined
        ? []
        : [
            {
              schedule,
              terms,
              cost: subscriptionCost(terms.recurrence, terms.amount.amount),
            },
          ];
    });
  const currency = settings.data?.base_currency;
  const total = (key: "monthly" | "yearly") =>
    rows.reduce((sum, r) => sum + r.cost[key], 0);
  if (schedules.isError)
    return (
      <QueryError
        error={schedules.error}
        onRetry={() => void schedules.refetch()}
      />
    );
  if (compact)
    return (
      <SubscriptionsList
        rows={rows}
        names={names}
        scale={scale}
        loading={schedules.isPending}
        totals={
          currency === undefined
            ? undefined
            : {
                monthly: { amount: total("monthly"), currency },
                yearly: { amount: total("yearly"), currency },
              }
        }
      />
    );
  return (
    <Table
      columns={8}
      variant="framed"
      loading={schedules.isFetching && !schedules.isPending}
    >
      <TableContent>
        <TableCaption>{t("subscriptions.caption")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("agenda.description")}</TableColumnHeader>
            <TableColumnHeader>{t("agenda.account")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("subscriptions.price")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("subscriptions.monthly")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("subscriptions.yearly")}
            </TableColumnHeader>
            <TableColumnHeader>{t("subscriptions.history")}</TableColumnHeader>
            <TableColumnHeader>{t("schedules.ends")}</TableColumnHeader>
            <TableColumnHeader sticky="end">
              {t("agenda.actions")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        {schedules.isPending || scale === null ? (
          <TableLoader skeletonRows={3} />
        ) : (
          <>
            <TableBody>
              {rows.length === 0 && (
                <TableEmpty>{t("subscriptions.empty")}</TableEmpty>
              )}
              {rows.map(({ schedule, terms, cost }) => {
                const name =
                  schedule.description === ""
                    ? t("ledger.untitled")
                    : schedule.description;
                const money = (amount: number) =>
                  fmt.money(
                    { amount, currency: terms.amount.currency },
                    scale(terms.amount.currency),
                  );
                return (
                  <TableRow key={schedule.id} value={schedule.id}>
                    <TableRowHeader text="truncate">
                      <AppLink
                        variant="neutral"
                        underline="hover"
                        to={{
                          to: "/planning/schedules/$id",
                          params: { id: schedule.id },
                        }}
                      >
                        {name}
                      </AppLink>
                    </TableRowHeader>
                    <TableCell text="truncate">
                      {names.get(schedule.account_id)}
                    </TableCell>
                    <TableCell numeric>{money(terms.amount.amount)}</TableCell>
                    <TableCell numeric>{money(cost.monthly)}</TableCell>
                    <TableCell numeric>{money(cost.yearly)}</TableCell>
                    <TableCell>
                      <div className={styles.history}>
                        {schedule.terms.map((v) => (
                          <Fragment key={v.effective_from}>
                            <Text size="sm" tone="muted" numeric="tabular">
                              {formatDate(v.effective_from, locale)}
                            </Text>
                            <Text size="sm" numeric="tabular">
                              {fmt.money(v.amount, scale(v.amount.currency))}
                            </Text>
                          </Fragment>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {schedule.ends_on === undefined
                        ? t("schedule.noEnd")
                        : formatDate(schedule.ends_on, locale)}
                    </TableCell>
                    <TableCell sticky="end">
                      <ScheduleActions schedule={schedule} name={name} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {currency !== undefined && rows.length > 0 && (
              <TableSummary>
                <TableRow>
                  <TableRowHeader colSpan={3}>
                    {t("subscriptions.total")}
                  </TableRowHeader>
                  <TableCell numeric>
                    {fmt.money(
                      { amount: total("monthly"), currency },
                      scale(currency),
                    )}
                  </TableCell>
                  <TableCell numeric>
                    {fmt.money(
                      { amount: total("yearly"), currency },
                      scale(currency),
                    )}
                  </TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableSummary>
            )}
          </>
        )}
      </TableContent>
    </Table>
  );
}
