import { Text } from "@slotted/react/typography";

import { FigureWidget } from "@/features/overview/figure-widget";
import { monthEnd } from "@/features/overview/forecast";
import type { Placement } from "@/features/overview/overview-block";
import { useOverview } from "@/features/overview/use-overview";
import { formatDayMonth, formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import type { MoneyAmount } from "@/ui/money-value";

export type MonthFlowKind = "income" | "outflow" | "result";

// Income, outflow or result of the Available accounts in the month; the result also says the
// balance the expected occurrences leave at its end.
export function MonthFlowFigure({
  month,
  kind,
  ...placement
}: { month: string; kind: MonthFlowKind } & Placement) {
  const t = useT();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const { overview, scale, failed, retry } = useOverview(month);
  const end = monthEnd(month);
  const money = (amount: number) =>
    overview === undefined || scale === null
      ? undefined
      : fmt.money({ amount, currency: overview.base }, scale(overview.base));
  const figure = (amount: number): MoneyAmount | undefined =>
    overview === undefined || scale === null
      ? undefined
      : {
          money: { amount, currency: overview.base },
          scale: scale(overview.base),
        };
  const flows = overview?.flows;
  const amounts = {
    income: flows?.income,
    outflow: flows?.spending,
    result: flows === undefined ? undefined : flows.income - flows.spending,
  };
  const amount = amounts[kind];
  return (
    <FigureWidget
      placement={placement}
      link={{
        label: t("overview.flows.open"),
        options: {
          to: "/transactions",
          search: { from: `${month}-01`, to: end },
        },
      }}
      error={failed}
      onRetry={retry}
      loading={overview === undefined && failed === null}
      goodWhen={kind === "outflow" ? "down" : "up"}
      value={amount === undefined ? undefined : figure(amount)}
      note={
        kind === "result"
          ? t("overview.flows.resultNote")
          : t("overview.flows.in", {
              month: formatMonthName(month, locale).toLocaleLowerCase(locale),
            })
      }
      footer={
        kind === "result" &&
        overview !== undefined &&
        overview.current && (
          <Text size="sm" tone="muted">
            {t("overview.flows.forecast", {
              date: formatDayMonth(end, locale),
              amount: money(overview.closing) ?? "",
            })}
          </Text>
        )
      }
    />
  );
}
