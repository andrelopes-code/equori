import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableGroupRow,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { schedulesQuery } from "@/features/planning/api";
import { SubscriptionRow } from "@/features/planning/subscription-row";
import {
  currentTerms,
  hasEnded,
  subscriptionCost,
} from "@/features/planning/schedule-words";
import { settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/query-error";

// The subscriptions: what each costs a month and a year at the price in force, and how its price
// moved from one terms version to the next.
export function SubscriptionsTab() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
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
  // The totals count what is still running: an ended subscription costs nothing from now on.
  const active = rows.filter((r) => !hasEnded(r.schedule.ends_on, today));
  const ended = rows
    .filter((r) => hasEnded(r.schedule.ends_on, today))
    .sort((x, y) =>
      (y.schedule.ends_on ?? "").localeCompare(x.schedule.ends_on ?? ""),
    );
  const total = (key: "monthly" | "yearly") =>
    active.reduce((sum, r) => sum + r.cost[key], 0);
  if (schedules.isError)
    return (
      <QueryError
        error={schedules.error}
        onRetry={() => void schedules.refetch()}
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
              {active.map(({ schedule, terms, cost }) => (
                <SubscriptionRow
                  key={schedule.id}
                  schedule={schedule}
                  terms={terms}
                  cost={cost}
                  accountNames={names}
                  scale={scale}
                />
              ))}
              {ended.length > 0 && (
                <>
                  <TableGroupRow>{t("schedules.ended")}</TableGroupRow>
                  {ended.map(({ schedule, terms, cost }) => (
                    <SubscriptionRow
                      key={schedule.id}
                      schedule={schedule}
                      terms={terms}
                      cost={cost}
                      accountNames={names}
                      scale={scale}
                      ended
                    />
                  ))}
                </>
              )}
            </TableBody>
            {currency !== undefined && active.length > 0 && (
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
