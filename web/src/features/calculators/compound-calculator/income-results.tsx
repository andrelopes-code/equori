import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { CalcTable } from "@/features/calculators/calculator-frame/calc-table";
import { FactRows } from "@/features/calculators/calculator-frame/fact-rows";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { yearlyIncome } from "@/features/calculators/model/compound-math";
import type { IncomeRow } from "@/features/calculators/model/compound-math";
import { useT } from "@/i18n/i18n-provider";

interface IncomeResultsProps {
  rows: readonly IncomeRow[];
  money: CalculatorMoney;
}

// The evidence of "live on income": the first month's income, the totals and the years in one
// short table.
export function IncomeResults({ rows, money }: IncomeResultsProps) {
  const t = useT();
  const first = rows[0];
  const last = rows[rows.length - 1];

  if (first === undefined || last === undefined) return null;

  const living = rows.reduce((sum, r) => sum + r.living, 0);
  const reinvested = rows.reduce((sum, r) => sum + r.reinvested, 0);

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("calc.compound.live.yearly")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <FactRows
          rows={[
            {
              term: t("calc.compound.live.firstIncome"),
              value: money.format(first.income),
            },
            {
              term: t("calc.compound.live.lastLiving"),
              value: money.format(last.living),
            },
            {
              term: t("calc.compound.live.totalLiving"),
              value: money.format(living),
            },
            {
              term: t("calc.compound.live.totalReinvested"),
              value: money.format(reinvested),
            },
            {
              term: t("calc.compound.live.growth"),
              value: money.format(last.closing - first.opening),
            },
          ]}
        />

        <CalcTable
          ruled
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
      </SectionBody>
    </Section>
  );
}
