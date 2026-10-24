import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { netWorthQuery } from "@/features/overview/api";
import { monthEnd, shiftMonth } from "@/features/overview/forecast";
import { changeOf } from "@/features/overview/net-worth";
import { OverviewLink } from "@/features/overview/overview-link";
import { useBase } from "@/features/overview/use-base";
import { useOverview } from "@/features/overview/use-overview";
import { committedQuery } from "@/features/planning";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { QueryError } from "@/ui/query-error";

// The four figures that lead the desk: where the wealth stands, what the month left, where the
// balance ends and what is already committed. Each opens the screen that owns it.
export function DesktopFigures({ month }: { month: string }) {
  const t = useT();
  const api = useApi();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const today = useToday();
  const { base, scale, error: baseError, retry: retryBase } = useBase();
  const previousDate = monthEnd(shiftMonth(month, -1));
  const enabled = base !== undefined;
  const now = useQuery({ ...netWorthQuery(api, today, base ?? ""), enabled });
  const before = useQuery({
    ...netWorthQuery(api, previousDate, base ?? ""),
    enabled,
  });
  const committed = useQuery(committedQuery(api, month));
  const { overview, failed, retry } = useOverview(month);
  const queries = [now, before, committed];
  const error =
    baseError ?? failed ?? queries.find((q) => q.error !== null)?.error ?? null;
  if (error !== null)
    return (
      <QueryError
        error={error}
        onRetry={() => {
          retryBase();
          retry();
          for (const query of queries) {
            if (query.isError) void query.refetch();
          }
        }}
      />
    );
  const digits = base === undefined || scale === null ? 0 : scale(base);
  const money = (amount: number | undefined) =>
    amount === undefined || base === undefined
      ? undefined
      : fmt.money({ amount, currency: base }, digits);
  const change =
    now.data === undefined || before.data === undefined
      ? undefined
      : changeOf(now.data.net.amount, before.data.net.amount);
  const flows = overview?.flows;
  const result =
    flows === undefined ? undefined : flows.income - flows.spending;
  const lowest = overview?.lowest;
  return (
    <FigureGrid label={t("overview.figures.label")}>
      <FigureCard
        label={t("overview.figures.net")}
        loading={now.data === undefined || before.data === undefined}
        value={money(now.data?.net.amount)}
        delta={change?.fraction}
        note={
          change === undefined
            ? ""
            : t("overview.netWorth.since", {
                change: fmt.signed(
                  { amount: change.amount, currency: base ?? "" },
                  digits,
                ),
                date: formatDayMonth(previousDate, locale),
              })
        }
        action={
          <OverviewLink options={{ to: "/accounts" }}>
            {t("overview.netWorth.open")}
          </OverviewLink>
        }
      />
      <FigureCard
        label={t("overview.figures.result")}
        loading={overview === undefined}
        value={money(result)}
        note={
          flows === undefined
            ? ""
            : t("overview.figures.resultNote", {
                income: money(flows.income) ?? "",
                outflow: money(flows.spending) ?? "",
              })
        }
        action={
          <OverviewLink
            options={{
              to: "/transactions",
              search: { from: `${month}-01`, to: monthEnd(month) },
            }}
          >
            {t("overview.flows.open")}
          </OverviewLink>
        }
      />
      <FigureCard
        label={t("overview.figures.balance")}
        loading={overview === undefined}
        value={money(overview?.closing)}
        note={
          lowest === null || lowest === undefined
            ? t("overview.figures.booked")
            : t("overview.figures.lowest", {
                amount: money(lowest.balance) ?? "",
                date: formatDayMonth(lowest.date, locale),
              })
        }
        action={
          <OverviewLink options={{ to: "/planning" }}>
            {t("overview.upcoming.open")}
          </OverviewLink>
        }
      />
      <FigureCard
        label={t("overview.figures.committed")}
        goodWhen="down"
        loading={committed.data === undefined}
        value={money(committed.data?.total.amount)}
        note={
          committed.data === undefined
            ? ""
            : t("overview.figures.committedNote", {
                installments: money(committed.data.installments.amount) ?? "",
              })
        }
        action={
          <OverviewLink options={{ to: "/planning" }}>
            {t("overview.upcoming.open")}
          </OverviewLink>
        }
      />
    </FigureGrid>
  );
}
