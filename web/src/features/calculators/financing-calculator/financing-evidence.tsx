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
import { SplitBars } from "@/features/calculators/calculator-frame/split-bars";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import type { AmortizationRow } from "@/features/calculators/financing-calculator/annuity";
import {
  financingFacts,
  splitBarRows,
} from "@/features/calculators/financing-calculator/financing-answer";
import { FinancingPrepay } from "@/features/calculators/financing-calculator/financing-prepay";
import { systemNames } from "@/features/calculators/financing-calculator/financing-region";
import { formatRate } from "@/features/calculators/model/format-rate";
import { monthlyToAnnual } from "@/features/calculators/model/rate-math";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";

interface FinancingEvidenceProps {
  price: AmortizationRow[];
  sac: AmortizationRow[];
  loan: { amount: number; rate: number; months: number };
  // The rate is solved: its yearly equivalent is stated beside the table.
  rateSolved: boolean;
  money: CalculatorMoney;
}

export function FinancingEvidence({
  price,
  sac,
  loan,
  rateSolved,
  money,
}: FinancingEvidenceProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { locale } = useAppLocaleState();
  const names = systemNames(locale.region);

  const facts = financingFacts(price, sac);
  const sacInterest = facts.interest - facts.saved;
  const first = (rows: AmortizationRow[]) => rows[0]?.installment ?? 0;
  const last = (rows: AmortizationRow[]) => rows.at(-1)?.installment ?? 0;

  const bars = splitBarRows({
    amount: loan.amount,
    systems: [
      { name: t(names.price), interest: facts.interest },
      { name: t(names.sac), interest: sacInterest },
    ],
    format: money.format,
    paidLabel: t("calc.financing.paid"),
    interestLabel: t("calc.financing.answer.interest"),
  });

  return (
    <>
      <Section size="lg">
        <SectionHeader>
          <SectionTitle>
            <SectionHeading>
              {t("calc.financing.split.title", {
                priceName: t(names.price),
                sacName: t(names.sac),
              })}
            </SectionHeading>
            <SectionDescription>
              {t("calc.financing.split.description")}
            </SectionDescription>
          </SectionTitle>
        </SectionHeader>

        <SectionBody>
          <SplitBars
            rows={bars}
            legend={[
              t("calc.financing.amount"),
              t("calc.financing.answer.interest"),
            ]}
          />

          <CalcTable
            ruled
            hideFirstHeader
            caption={t(names.compare)}
            headers={[t("calc.financing.figure"), t(names.price), t(names.sac)]}
            rows={[
              {
                key: "first",
                cells: [
                  t("calc.financing.first"),
                  money.format(first(price)),
                  money.format(first(sac)),
                ],
              },
              {
                key: "last",
                cells: [
                  t("calc.financing.last"),
                  money.format(last(price)),
                  money.format(last(sac)),
                ],
              },
              {
                key: "interest",
                cells: [
                  t("calc.financing.interest"),
                  money.format(facts.interest),
                  money.format(sacInterest),
                ],
              },
            ]}
          />

          {rateSolved && (
            <FactRows
              rows={[
                {
                  term: t("calc.financing.solved.annual"),
                  value: formatRate(monthlyToAnnual(loan.rate), tag),
                },
              ]}
            />
          )}
        </SectionBody>
      </Section>

      <FinancingPrepay loan={loan} money={money} />
    </>
  );
}
