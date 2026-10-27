import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { netWorthQuery } from "@/features/overview/api";
import { FigureWidget } from "@/features/overview/figure-widget";
import { monthEnd, shiftMonth } from "@/features/overview/forecast";
import { changeOf } from "@/features/overview/net-worth";
import type { Placement } from "@/features/overview/overview-block";
import { useBase } from "@/features/overview/use-base";
import { useOverview } from "@/features/overview/use-overview";
import { committedQuery } from "@/features/planning";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

export type DesktopFigureKind = "net" | "result" | "balance" | "committed";

// One of the four figures that lead the desk: where the wealth stands, what the month left, where
// the balance ends and what is already committed. Each opens the screen that owns it.
export function DesktopFigure({
  month,
  kind,
  ...placement
}: { month: string; kind: DesktopFigureKind } & Placement) {
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
  const queries =
    kind === "net" ? [now, before] : kind === "committed" ? [committed] : [];
  const error =
    baseError ??
    (kind === "result" || kind === "balance" ? failed : null) ??
    queries.find((q) => q.error !== null)?.error ??
    null;
  const onRetry = () => {
    retryBase();
    retry();
    for (const query of queries) {
      if (query.isError) void query.refetch();
    }
  };
  const digits = base === undefined || scale === null ? 0 : scale(base);
  const money = (amount: number | undefined) =>
    amount === undefined || base === undefined
      ? undefined
      : fmt.money({ amount, currency: base }, digits);
  const common = { placement, error, onRetry };
  if (kind === "net") {
    const change =
      now.data === undefined || before.data === undefined
        ? undefined
        : changeOf(now.data.net.amount, before.data.net.amount);
    return (
      <FigureWidget
        {...common}
        link={{
          label: t("overview.netWorth.open"),
          options: { to: "/reports" },
        }}
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
      />
    );
  }
  if (kind === "result") {
    const flows = overview?.flows;
    return (
      <FigureWidget
        {...common}
        link={{
          label: t("overview.flows.open"),
          options: {
            to: "/transactions",
            search: { from: `${month}-01`, to: monthEnd(month) },
          },
        }}
        loading={overview === undefined}
        value={money(
          flows === undefined ? undefined : flows.income - flows.spending,
        )}
        note={
          flows === undefined
            ? ""
            : t("overview.figures.resultNote", {
                income: money(flows.income) ?? "",
                outflow: money(flows.spending) ?? "",
              })
        }
      />
    );
  }
  if (kind === "balance") {
    const lowest = overview?.lowest;
    return (
      <FigureWidget
        {...common}
        link={{
          label: t("overview.upcoming.open"),
          options: { to: "/planning" },
        }}
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
      />
    );
  }
  return (
    <FigureWidget
      {...common}
      link={{
        label: t("overview.upcoming.open"),
        options: { to: "/planning" },
      }}
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
    />
  );
}
