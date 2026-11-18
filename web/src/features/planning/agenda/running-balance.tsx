import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useCallback, useMemo } from "react";

import { lowestPoint } from "@/features/planning/agenda/month-close";
import type { BalancePoint } from "@/features/planning/agenda/month-close";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface RunningBalanceProps {
  series: readonly BalancePoint[];
  currency: string;
  scale: number;
  label: string;
}

const xAxis = { field: "label" } as const;

// The month's planned flow day by day, from zero, under a sentence that reads its lowest point
// and its close (spec A6).
export function RunningBalance({
  series,
  currency,
  scale,
  label,
}: RunningBalanceProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const format = useCallback(
    (value: number) =>
      fmt.money({ amount: Math.round(value), currency }, scale),
    [fmt, currency, scale],
  );
  const data = useMemo(
    () =>
      series.map((p) => ({
        label: formatDayMonth(p.date, locale),
        amount: p.amount,
      })),
    [series, locale],
  );
  const chartSeries = useMemo(
    () =>
      [
        {
          id: "balance",
          kind: "line",
          field: "amount",
          label,
          tone: "accent",
          format,
        },
      ] satisfies ChartSeries<"label" | "amount">[],
    [label, format],
  );
  const yAxis = useMemo(() => ({ format }), [format]);
  const low = lowestPoint(series);
  const close = series.at(-1);
  if (low === undefined || close === undefined) return null;

  const closeText = fmt.signed({ amount: close.amount, currency }, scale);
  const sentence =
    low.amount < 0
      ? t("agenda.runningLow", {
          amount: fmt.signed({ amount: low.amount, currency }, scale),
          date: formatDayMonth(low.date, locale),
          close: closeText,
        })
      : t("agenda.runningFlat", { close: closeText });

  return (
    <Section className="mt-6">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{label}</SectionHeading>
          <SectionDescription>{sentence}</SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <Chart
          aria-label={label}
          size="sm"
          legend={false}
          data={data}
          series={chartSeries}
          x={xAxis}
          y={yAxis}
        />
      </SectionBody>
    </Section>
  );
}
