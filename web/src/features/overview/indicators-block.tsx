import { Sparkline } from "@slotted/react/sparkline";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { indicatorsQuery } from "@/features/overview/api";
import {
  lastMonth,
  ratioSeries,
  showsDebt,
  type IndicatorMonth,
  type RatioKey,
} from "@/features/overview/indicators";
import { OverviewBlock } from "@/features/overview/overview-block";
import { useBase } from "@/features/overview/use-base";
import { formatBasisPoints, formatMonths } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

// Savings rate, reserve, committed income and debt payments of the month in the cash view, each
// with its 12-month line and no judgment of good or bad (analytics design 5.1).
export function IndicatorsBlock({
  month,
  onHide,
}: {
  month: string;
  onHide?: (() => void) | undefined;
}) {
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

  const figure = (
    key: RatioKey,
    label: string,
    value: (bp: number) => string,
    note: (m: IndicatorMonth) => string,
  ) => {
    if (report === undefined) return null;
    const m = lastMonth(report);
    const ratio = m[key];
    return (
      <FigureCard
        key={key}
        label={label}
        goodWhen="none"
        value={ratio.bp === undefined ? undefined : value(ratio.bp)}
        note={
          ratio.reason === undefined
            ? note(m)
            : t(`overview.indicators.reason.${ratio.reason}`)
        }
        trend={
          <Sparkline
            size="sm"
            data={ratioSeries(report, key)}
            label={label}
            valueFormatter={value}
          />
        }
      />
    );
  };

  const amount = (m: { amount: number; currency: string }) =>
    fmt.money(m, scale === null ? 0 : scale(m.currency));
  const meanOf = (m?: { amount: number; currency: string }) =>
    m === undefined ? "" : amount(m);

  return (
    <OverviewBlock
      onHide={onHide}
      title={t("overview.indicators.title")}
      link={{
        label: t("overview.indicators.open"),
        options: { to: "/reports" },
      }}
      loading={report === undefined && query.error === null}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {report !== undefined && (
        <FigureGrid label={t("overview.indicators.label")}>
          {figure(
            "savings_rate",
            t("overview.indicators.savings"),
            percent,
            () => {
              const trailing = lastMonth(report).trailing_savings_rate.bp;
              return trailing === undefined
                ? t("overview.indicators.savingsNoteShort")
                : t("overview.indicators.savingsNote", {
                    mean: percent(trailing),
                  });
            },
          )}
          {figure("liquidity", t("overview.indicators.reserve"), months, (m) =>
            t("overview.indicators.reserveNote", {
              liquid: amount(m.liquid_balance),
              expense: meanOf(m.mean_expense),
            }),
          )}
          {figure(
            "committed_share",
            t("overview.indicators.committed"),
            percent,
            (m) =>
              t("overview.indicators.committedNote", {
                committed: amount(m.committed),
                income: meanOf(m.mean_income),
              }),
          )}
          {showsDebt(lastMonth(report)) &&
            figure(
              "debt_service_share",
              t("overview.indicators.debt"),
              percent,
              (m) =>
                t("overview.indicators.debtNote", {
                  debt: amount(m.debt_service),
                  income: meanOf(m.mean_income),
                }),
            )}
        </FigureGrid>
      )}
    </OverviewBlock>
  );
}
