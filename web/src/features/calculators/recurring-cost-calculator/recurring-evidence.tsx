import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { SplitBars } from "@/features/calculators/calculator-frame/split-bars";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useT } from "@/i18n/i18n-provider";

interface RecurringEvidenceProps {
  money: CalculatorMoney;
  // Minor units.
  total: number;
  futureValue: number;
}

export function RecurringEvidence({
  money,
  total,
  futureValue,
}: RecurringEvidenceProps) {
  const t = useT();
  const bars = [
    { name: t("calc.recurring.total"), amount: total },
    { name: t("calc.recurring.futureValue"), amount: futureValue },
  ];

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("calc.recurring.bars.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <SplitBars
          rows={bars.map(({ name, amount }) => {
            const value = money.format(amount);

            return {
              name,
              parts: [amount],
              total: value,
              label: `${name} ${value}`,
            };
          })}
        />
      </SectionBody>
    </Section>
  );
}
