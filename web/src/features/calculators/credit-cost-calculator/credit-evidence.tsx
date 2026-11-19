import { Field } from "@slotted/react/field";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionTitle,
} from "@slotted/react/section";

import { FactRows } from "@/features/calculators/calculator-frame/fact-rows";
import { SplitBars } from "@/features/calculators/calculator-frame/split-bars";
import type { CreditAnswer } from "@/features/calculators/credit-cost-calculator/credit-answer";
import { regionalTerms } from "@/features/calculators/credit-cost-calculator/credit-region";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";

interface CreditEvidenceProps {
  money: CalculatorMoney;
  answer: Extract<CreditAnswer, { kind: "solved" }>;
  // Minor units.
  released: number;
}

export function CreditEvidence({
  money,
  answer,
  released,
}: CreditEvidenceProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { locale: profile } = useAppLocaleState();
  const { nominal } = regionalTerms(profile.region);
  const name = t("calc.credit.paid");
  const total = money.format(answer.paid);
  const split = {
    released: t("calc.credit.split.released"),
    cost: t("calc.credit.split.cost"),
  };

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <Field necessity="none">
            <FieldTitle
              label={t("calc.credit.split.title")}
              help={t("calc.credit.annual.help")}
            />
          </Field>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <SplitBars
          rows={[
            {
              name,
              parts: [released, answer.cost],
              total,
              label: `${name} ${total}: ${split.released} ${money.format(released)}, ${split.cost} ${money.format(answer.cost)}`,
            },
          ]}
          legend={[split.released, split.cost]}
        />

        {nominal !== null && (
          <FactRows
            rows={[
              {
                term: t(nominal),
                value: formatRate(answer.monthly * 12, tag, {
                  min: 2,
                  max: 2,
                }),
              },
            ]}
          />
        )}
      </SectionBody>
    </Section>
  );
}
