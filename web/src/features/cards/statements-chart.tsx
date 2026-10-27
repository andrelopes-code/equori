import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";
import { memo, useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementSummary"];
type Money = components["schemas"]["Money"];

// What each of the last twelve statements billed, then what the installments already commit to
// the next twelve: one bar per reference month.
export const StatementsChart = memo(function StatementsChart({
  statements,
  commitments,
  currency,
  scale,
  loading,
}: {
  statements: readonly Statement[];
  commitments: readonly { month: string; amount: Money | undefined }[];
  currency: string;
  scale: number;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const data = useMemo(() => {
    const past = statements
      .filter((s) => s.status !== "open")
      .slice(-12)
      .map((s) => ({
        month: s.reference,
        label: formatReferenceMonth(s.reference, locale),
        billed: s.billed_amount.amount,
        committed: null,
      }));
    const open = statements.find((s) => s.status === "open");
    const now =
      open === undefined
        ? []
        : [
            {
              month: open.reference,
              label: formatReferenceMonth(open.reference, locale),
              billed: open.amount_due.amount,
              committed: null,
            },
          ];
    const ahead = commitments.map((c) => ({
      month: c.month,
      label: formatReferenceMonth(c.month, locale),
      billed: null,
      committed: c.amount?.amount ?? 0,
    }));
    return [...past, ...now, ...ahead];
  }, [statements, commitments, locale]);
  const money = (value: number) =>
    fmt.money({ amount: value, currency }, scale);
  const series: ChartSeries<"label" | "month" | "committed" | "billed">[] = [
    {
      id: "billed",
      kind: "bar",
      field: "billed",
      label: t("card.chart.billed"),
      format: money,
    },
    {
      id: "committed",
      kind: "bar",
      field: "committed",
      label: t("card.chart.committed"),
      tone: "neutral",
      format: money,
    },
  ];
  return (
    <Chart
      variant="card"
      size="sm"
      loading={loading}
      title={t("card.chart.title")}
      data={data}
      series={series}
      x={{ field: "label" }}
      y={{ format: money }}
    />
  );
});
