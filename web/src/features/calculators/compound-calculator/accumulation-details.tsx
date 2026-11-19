import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { Stack } from "@slotted/react/stack";

import { CalcTable } from "@/features/calculators/calculator-frame/calc-table";
import { CalculatorDetails } from "@/features/calculators/calculator-frame/calculator-details";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { balances } from "@/features/calculators/model/compound-math";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AccumulationDetailsProps {
  initial: number;
  deposit: number;
  j: number;
  months: number;
  money: CalculatorMoney;
}

export function AccumulationDetails({
  initial,
  deposit,
  j,
  months,
  money,
}: AccumulationDetailsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const rows = balances(initial, deposit, j, months);
  const format = (v: number) => money.format(v);
  const series: ChartSeries<"label" | "balance" | "deposited">[] = [
    {
      id: "balance",
      kind: "line",
      field: "balance",
      label: t("calc.compound.chart.balance"),
      format,
    },
    {
      id: "deposited",
      kind: "line",
      field: "deposited",
      label: t("calc.compound.chart.deposited"),
      format,
    },
  ];

  return (
    <CalculatorDetails
      title={t("calc.compound.details")}
      size={t("calc.compound.details.size", {
        months: numberFormatter(tag).format(months),
      })}
    >
      <Stack gap={5}>
        <Chart
          variant="card"
          aria-label={t("calc.compound.chart")}
          data={rows.map((r) => ({
            label: t("calc.compound.chart.month", { month: r.month }),
            balance: r.balance,
            deposited: r.deposited,
          }))}
          series={series}
          x={{ field: "label" }}
          y={{ format }}
        />

        <CalcTable
          long
          caption={t("calc.compound.details")}
          headers={[
            t("calc.compound.live.col.month"),
            t("calc.compound.chart.balance"),
            t("calc.compound.chart.deposited"),
          ]}
          rows={rows.map((r) => ({
            key: String(r.month),
            cells: [
              String(r.month),
              money.format(r.balance),
              money.format(r.deposited),
            ],
          }))}
        />
      </Stack>
    </CalculatorDetails>
  );
}
