import { Text } from "@slotted/react/typography";

import { monthEnd } from "@/features/overview/forecast";
import { OverviewBlock } from "@/features/overview/overview-block";
import { useOverview } from "@/features/overview/use-overview";
import { formatDayMonth, formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

// Income, outflow and result of the Available accounts in the month, and the balance the
// expected occurrences leave at its end.
export function MonthFlowsBlock({
  month,
  onHide,
}: {
  month: string;
  onHide?: (() => void) | undefined;
}) {
  const t = useT();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const { overview, scale, failed, retry } = useOverview(month);
  const end = monthEnd(month);
  const money = (amount: number) =>
    overview === undefined || scale === null
      ? undefined
      : fmt.money({ amount, currency: overview.base }, scale(overview.base));
  const loading = overview === undefined && failed === null;
  const note = t("overview.flows.in", {
    month: formatMonthName(month, locale).toLocaleLowerCase(locale),
  });
  const flows = overview?.flows;
  return (
    <OverviewBlock
      onHide={onHide}
      title={t("overview.flows.title")}
      link={{
        label: t("overview.flows.open"),
        options: {
          to: "/transactions",
          search: { from: `${month}-01`, to: end },
        },
      }}
      loading={false}
      error={failed}
      onRetry={retry}
    >
      <FigureGrid label={t("overview.flows.figures")}>
        <FigureCard
          label={t("overview.flows.income")}
          loading={loading}
          value={flows === undefined ? undefined : money(flows.income)}
          note={note}
        />
        <FigureCard
          label={t("overview.flows.outflow")}
          loading={loading}
          goodWhen="down"
          value={flows === undefined ? undefined : money(flows.spending)}
          note={note}
        />
        <FigureCard
          label={t("overview.flows.result")}
          loading={loading}
          value={
            flows === undefined
              ? undefined
              : money(flows.income - flows.spending)
          }
          note={t("overview.flows.resultNote")}
        />
      </FigureGrid>
      {overview !== undefined && overview.current && (
        <Text size="sm" tone="muted">
          {t("overview.flows.forecast", {
            date: formatDayMonth(end, locale),
            amount: money(overview.closing) ?? "",
          })}
        </Text>
      )}
    </OverviewBlock>
  );
}
