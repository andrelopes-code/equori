import { Field } from "@slotted/react/field";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionTitle,
} from "@slotted/react/section";

import { FactRows } from "@/features/calculators/calculator-frame/fact-rows";
import { SplitBars } from "@/features/calculators/calculator-frame/split-bars";
import type { CashAnswer } from "@/features/calculators/cash-or-installments-calculator/cash-answer";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import { monthlyToAnnual } from "@/features/calculators/model/rate-math";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";

interface CashEvidenceProps {
  money: CalculatorMoney;
  answer: CashAnswer;
  // The cash price in minor units.
  cash: number;
}

export function CashEvidence({ money, answer, cash }: CashEvidenceProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { comparison, implied } = answer;
  // The answer states the implied rates beside a comparison; without one they stand here.
  const rates =
    comparison === null && typeof implied === "number"
      ? [
          { term: t("calc.cash.monthly"), value: formatRate(implied, tag) },
          {
            term: t("calc.cash.annual"),
            value: formatRate(monthlyToAnnual(implied), tag),
          },
        ]
      : [];

  return (
    <Section size="lg">
      {comparison !== null && (
        <SectionHeader>
          <SectionTitle>
            <Field necessity="none">
              <FieldTitle
                label={t("calc.cash.bars.title")}
                help={`${t("calc.cash.implied.help")} ${t("calc.cash.present.help")}`}
              />
            </Field>
          </SectionTitle>
        </SectionHeader>
      )}

      <SectionBody>
        {comparison !== null && (
          <SplitBars
            rows={[
              bar(t("calc.cash.bars.cash"), cash, money),
              bar(t("calc.cash.bars.present"), comparison.presentValue, money),
            ]}
          />
        )}

        <FactRows
          rows={[
            ...rates,
            { term: t("calc.cash.total"), value: money.format(answer.total) },
          ]}
        />
      </SectionBody>
    </Section>
  );
}

function bar(name: string, amount: number, money: CalculatorMoney) {
  const total = money.format(amount);

  return { name, parts: [amount], total, label: `${name} ${total}` };
}
