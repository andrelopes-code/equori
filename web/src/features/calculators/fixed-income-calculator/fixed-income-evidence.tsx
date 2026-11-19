import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { FactRows } from "@/features/calculators/calculator-frame/fact-rows";
import { SplitBars } from "@/features/calculators/calculator-frame/split-bars";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import type { fixedIncomeAnswer } from "@/features/calculators/fixed-income-calculator/fixed-income-answer";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface FixedIncomeEvidenceProps {
  money: CalculatorMoney;
  answer: NonNullable<ReturnType<typeof fixedIncomeAnswer>>;
  exempt: boolean;
}

export function FixedIncomeEvidence({
  money,
  answer,
  exempt,
}: FixedIncomeEvidenceProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const name = t("calc.fixedIncome.gross");
  const total = money.format(answer.gross);

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("calc.fixedIncome.split.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <SplitBars
          rows={[
            {
              name,
              parts: [answer.net, answer.tax],
              total,
              label: `${name} ${total}: ${t("calc.fixedIncome.split.net")} ${money.format(answer.net)}, ${t("calc.fixedIncome.split.tax")} ${money.format(answer.tax)}`,
            },
          ]}
          legend={[
            t("calc.fixedIncome.split.net"),
            t("calc.fixedIncome.split.tax"),
          ]}
        />

        <FactRows
          rows={[
            {
              term: t(
                exempt
                  ? "calc.fixedIncome.equivalentTaxable"
                  : "calc.fixedIncome.equivalentExempt",
              ),
              note: t("calc.fixedIncome.equivalent.help"),
              value: formatRate(answer.equivalent, tag),
            },
          ]}
        />
      </SectionBody>
    </Section>
  );
}
