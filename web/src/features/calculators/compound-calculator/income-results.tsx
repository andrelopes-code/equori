import { Stack } from "@slotted/react/stack";

import { CalcTable } from "@/features/calculators/calculator-frame/calc-table";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { yearlyIncome } from "@/features/calculators/model/compound-math";
import type { IncomeRow } from "@/features/calculators/model/compound-math";
import { ResultLead } from "@/features/calculators/result/result-lead";
import { ResultList } from "@/features/calculators/result/result-list";
import { useT } from "@/i18n/i18n-provider";

interface IncomeResultsProps {
  rows: readonly IncomeRow[];
  money: CalculatorMoney;
  share: number;
}

// The answer of "live on income": the closing balance, the first month against the last, the
// totals, and the years in one short table.
export function IncomeResults({ rows, money, share }: IncomeResultsProps) {
  const t = useT();
  const first = rows[0];
  const last = rows[rows.length - 1];

  if (first === undefined || last === undefined) return null;

  const living = rows.reduce((sum, r) => sum + r.living, 0);
  const reinvested = rows.reduce((sum, r) => sum + r.reinvested, 0);
  const percent = Number((share * 100).toFixed(2));

  return (
    <Stack gap={5}>
      <ResultLead
        label={t("calc.compound.live.final")}
        value={money.format(last.closing)}
        summary={t("calc.compound.live.summary", {
          months: rows.length,
          living: money.format(living),
          reinvested: money.format(reinvested),
        })}
      />

      <ResultList
        results={[
          {
            label: t("calc.compound.live.firstIncome"),
            value: money.format(first.income),
          },
          {
            label: t("calc.compound.live.firstReinvested", { share: percent }),
            value: money.format(first.reinvested),
          },
          {
            label: t("calc.compound.live.firstLiving"),
            value: money.format(first.living),
          },
          {
            label: t("calc.compound.live.lastLiving"),
            value: money.format(last.living),
          },
          {
            label: t("calc.compound.live.totalLiving"),
            value: money.format(living),
          },
          {
            label: t("calc.compound.live.totalReinvested"),
            value: money.format(reinvested),
          },
          {
            label: t("calc.compound.live.growth"),
            value: money.format(last.closing - first.opening),
          },
        ]}
      />

      <CalcTable
        caption={t("calc.compound.live.yearly")}
        headers={[
          t("calc.compound.live.col.year"),
          t("calc.compound.live.col.opening"),
          t("calc.compound.live.col.reinvested"),
          t("calc.compound.live.col.living"),
          t("calc.compound.live.col.closing"),
        ]}
        rows={yearlyIncome(rows).map((y) => ({
          key: String(y.year),
          cells: [
            t("calc.compound.live.year", { year: y.year }),
            money.format(y.opening),
            money.format(y.reinvested),
            money.format(y.living),
            money.format(y.closing),
          ],
        }))}
      />
    </Stack>
  );
}
