import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { FactRows } from "@/features/calculators/calculator-frame/fact-rows";
import {
  termIncome,
  termIncomeRows,
} from "@/features/calculators/compound-calculator/income-figures";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { REINVESTED_SHARE } from "@/features/calculators/model/compound-math";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TermIncomeRowsProps {
  final: number;
  j: number;
  months: number;
  inflation: number | null;
  withdraw: number | null;
  money: CalculatorMoney;
}

// The monthly income the final amount pays after the term, as labelled rows.
export function TermIncomeRows({
  final,
  j,
  months,
  inflation,
  withdraw,
  money,
}: TermIncomeRowsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const income = termIncome({ final, j, inflation, months, withdraw });
  const rows = termIncomeRows({
    income,
    inflation: inflation !== null,
    format: money.format,
    labels: {
      lasting: t("calc.compound.rows.lasting"),
      same: t("calc.compound.rows.same"),
      atEnd: t("calc.compound.rows.atEnd"),
      today: t("calc.compound.rows.today"),
      reinvest: t("calc.compound.rows.reinvest", {
        share: formatRate(REINVESTED_SHARE, tag),
      }),
      living: t("calc.compound.rows.living", {
        share: formatRate(1 - REINVESTED_SHARE, tag),
      }),
      spending: t("calc.compound.income.spending"),
    },
  });

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("calc.compound.rows.title")}</SectionHeading>
          <SectionDescription>
            {t("calc.compound.rows.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        {income.lasting === null && (
          <Alert tone="warning">
            <AlertContent>
              <AlertDescription>
                {t("calc.compound.income.none")}
              </AlertDescription>
            </AlertContent>
          </Alert>
        )}

        <FactRows rows={rows} />
      </SectionBody>
    </Section>
  );
}
