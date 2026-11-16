import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { CalcTable } from "@/features/calculators/calculator-frame/calc-table";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import type { IncomeRow } from "@/features/calculators/model/compound-math";
import { useT } from "@/i18n/i18n-provider";

interface IncomeDetailsProps {
  rows: readonly IncomeRow[];
  money: CalculatorMoney;
}

// The evidence of "live on income": the balance by month and every month in a table.
export function IncomeDetails({ rows, money }: IncomeDetailsProps) {
  const t = useT();
  const format = (v: number) => money.format(v);
  const series: ChartSeries<"label" | "balance">[] = [
    {
      id: "balance",
      kind: "line",
      field: "balance",
      label: t("calc.compound.chart.balance"),
      format,
    },
  ];

  return (
    <Stack gap={5}>
      <Chart
        variant="card"
        title={t("calc.compound.live.chart")}
        data={rows.map((r) => ({
          label: t("calc.compound.chart.month", { month: r.month }),
          balance: r.closing,
        }))}
        series={series}
        x={{ field: "label" }}
        y={{ format }}
      />

      <CalcTable
        long
        caption={t("calc.compound.live.monthly")}
        headers={[
          t("calc.compound.live.col.month"),
          t("calc.compound.live.col.opening"),
          t("calc.compound.live.col.income"),
          t("calc.compound.live.col.reinvested"),
          t("calc.compound.live.col.living"),
          t("calc.compound.live.col.closing"),
        ]}
        rows={rows.map((r) => ({
          key: String(r.month),
          cells: [
            String(r.month),
            money.format(r.opening),
            money.format(r.income),
            money.format(r.reinvested),
            money.format(r.living),
            money.format(r.closing),
          ],
        }))}
      />

      <Text size="sm" tone="muted">
        {t("calc.estimate")}
      </Text>
    </Stack>
  );
}
