import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { CalcTable } from "@/features/calculators/calculator-frame/calc-table";
import { FactRows } from "@/features/calculators/calculator-frame/fact-rows";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { incomeTotals } from "@/features/calculators/compound-calculator/income-figures";
import { yearlyIncome } from "@/features/calculators/model/compound-math";
import type { IncomeRow } from "@/features/calculators/model/compound-math";
import { useT } from "@/i18n/i18n-provider";

interface IncomeResultsProps {
  rows: readonly IncomeRow[];
  // The income that spends the balance over the withdrawal term, in the money of the rows.
  spending: number | null;
  // An inflation is set: the rows are in today's money and say so.
  inflation: boolean;
  money: CalculatorMoney;
}

// The evidence of "live on income": the first month's income, the totals and the years in one
// short table.
export function IncomeResults({
  rows,
  spending,
  inflation,
  money,
}: IncomeResultsProps) {
  const t = useT();
  const first = rows[0];
  const last = rows[rows.length - 1];

  if (first === undefined || last === undefined) return null;

  const { living, reinvested } = incomeTotals(rows);

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("calc.compound.live.yearly")}</SectionHeading>
          {inflation && (
            <SectionDescription>
              {t("calc.compound.live.today")}
            </SectionDescription>
          )}
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
            ...(spending === null
              ? []
              : [
                  {
                    term: t("calc.compound.income.spending"),
                    value: money.format(spending),
                  },
                ]),
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
