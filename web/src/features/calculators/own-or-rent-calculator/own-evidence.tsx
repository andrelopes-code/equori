import { Field } from "@slotted/react/field";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionTitle,
} from "@slotted/react/section";

import { FactRows } from "@/features/calculators/calculator-frame/fact-rows";
import { SplitBars } from "@/features/calculators/calculator-frame/split-bars";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { componentOrder } from "@/features/calculators/own-or-rent-calculator/own-answer";
import type { OwnAnswer } from "@/features/calculators/own-or-rent-calculator/own-answer";
import type { OwnershipComponent } from "@/features/calculators/model/plan-math";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";

interface OwnEvidenceProps {
  money: CalculatorMoney;
  answer: Extract<OwnAnswer, { kind: "solved" }>;
}

const componentLabels: Record<OwnershipComponent, MessageKey> = {
  forgone: "calc.own.forgone",
  propertyTax: "calc.own.propertyTaxCost",
  deduction: "calc.own.deduction",
  maintenance: "calc.own.maintenance",
  appreciation: "calc.own.appreciation",
  riskPremium: "calc.own.riskPremium",
};

export function OwnEvidence({ money, answer }: OwnEvidenceProps) {
  const t = useT();
  const own = money.format(answer.own);
  const rent = money.format(answer.rent);
  const ownName = t("calc.own.total");
  const rentName = t("calc.own.rentYear");
  const parts = componentOrder.map((component) => ({
    term: t(componentLabels[component]),
    value: money.format(answer.components[component]),
  }));

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <Field necessity="none">
            <FieldTitle label={t("calc.own.bars.title")} />
          </Field>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <SplitBars
          rows={[
            {
              name: ownName,
              parts: answer.parts,
              total: own,
              label: `${ownName} ${own}: ${parts.map((p) => `${p.term} ${p.value}`).join(", ")}`,
            },
            {
              name: rentName,
              parts: [answer.rent],
              total: rent,
              label: `${rentName} ${rent}`,
            },
          ]}
          legend={parts.map((p) => p.term)}
        />

        <FactRows rows={parts} />
      </SectionBody>
    </Section>
  );
}
