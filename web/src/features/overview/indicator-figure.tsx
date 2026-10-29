import { Sparkline } from "@slotted/react/sparkline";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { indicatorsQuery } from "@/features/overview/api";
import { FigureWidget } from "@/features/overview/figure-widget";
import {
  indicatorSeries,
  lastMonth,
  showsDebt,
  type IndicatorMonth,
} from "@/features/overview/indicators";
import type { Placement } from "@/features/overview/overview-block";
import { useBase } from "@/features/overview/use-base";
import { formatBasisPoints, formatMonths } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

export type IndicatorKind =
  "savings_rate" | "liquidity" | "committed_share" | "debt_service_share";

// One indicator of the month in the cash view, with no judgment of good or bad. Its 12-month series
// is the indicators tab of reports (analytics design 5.1).
export function IndicatorFigure({
  month,
  kind,
  ...placement
}: { month: string; kind: IndicatorKind } & Placement) {
  const t = useT();
  const api = useApi();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const query = useQuery(indicatorsQuery(api, month));
  const report = query.data;
  const percent = (bp: number) => formatBasisPoints(bp, locale);
  const months = (bp: number) =>
    t("overview.indicators.months", { months: formatMonths(bp, locale) });
  const format = kind === "liquidity" ? months : percent;
  const amount = (m: { amount: number; currency: string }) =>
    fmt.money(m, scale === null ? 0 : scale(m.currency));
  const meanOf = (m?: { amount: number; currency: string }) =>
    m === undefined ? "" : amount(m);
  const noteOf = (m: IndicatorMonth): string => {
    switch (kind) {
      case "savings_rate":
        return m.trailing_savings_rate.bp === undefined
          ? t("overview.indicators.savingsNoteShort")
          : t("overview.indicators.savingsNote", {
              mean: percent(m.trailing_savings_rate.bp),
            });
      case "liquidity":
        return t("overview.indicators.reserveNote", {
          liquid: amount(m.liquid_balance),
          expense: meanOf(m.mean_expense),
        });
      case "committed_share":
        return t("overview.indicators.committedNote", {
          committed: amount(m.committed),
          income: meanOf(m.mean_income),
        });
      case "debt_service_share":
        return t("overview.indicators.debtNote", {
          debt: amount(m.debt_service),
          income: meanOf(m.mean_income),
        });
    }
  };
  const m = report === undefined ? undefined : lastMonth(report);
  // Debt payments read only for books that hold or pay a debt (analytics design 5.1); the widget
  // keeps its cell and says so.
  const noDebt =
    kind === "debt_service_share" && m !== undefined && !showsDebt(m);
  const ratio = noDebt ? undefined : m?.[kind];
  const series =
    noDebt || report === undefined ? [] : indicatorSeries(report, kind);
  const trend =
    series.length === 0 ? undefined : (
      <Sparkline
        data={series}
        label={t("overview.indicators.trend", { name: placement.title })}
        valueFormatter={format}
      />
    );
  return (
    <FigureWidget
      placement={placement}
      link={{
        label: t("overview.indicators.open"),
        options: { to: "/reports", search: { tab: "indicators" } },
      }}
      error={query.error}
      onRetry={() => void query.refetch()}
      loading={report === undefined}
      goodWhen="none"
      trend={trend}
      value={ratio?.bp === undefined ? undefined : format(ratio.bp)}
      note={
        noDebt
          ? t("overview.indicators.noDebt")
          : m === undefined || ratio === undefined
            ? ""
            : ratio.reason === undefined
              ? noteOf(m)
              : t(`overview.indicators.reason.${ratio.reason}`)
      }
    />
  );
}
