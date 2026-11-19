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
import { componentOrder } from "@/features/calculators/own-or-rent-calculator/own-answer";
import type { OwnAnswer } from "@/features/calculators/own-or-rent-calculator/own-answer";
import type { OwnershipComponent } from "@/features/calculators/model/plan-math";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

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

const legendLabels: Record<OwnershipComponent, MessageKey> = {
  forgone: "calc.own.legend.forgone",
  propertyTax: "calc.own.legend.propertyTax",
  deduction: "calc.own.legend.deduction",
  maintenance: "calc.own.legend.maintenance",
  appreciation: "calc.own.legend.appreciation",
  riskPremium: "calc.own.legend.riskPremium",
};

export function OwnEvidence({ money, answer }: OwnEvidenceProps) {
  const t = useT();
  const own = money.format(answer.own);
  const rent = money.format(answer.rent);
  const ownName = t("calc.own.bars.own");
  const rentName = t("calc.own.bars.rent");
  const parts = componentOrder.map((component) => ({
    term: t(componentLabels[component]),
    value: money.format(answer.components[component]),
  }));

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("calc.own.bars.title")}</SectionHeading>
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
          legend={componentOrder.map((component) => t(legendLabels[component]))}
        />

        <FactRows rows={parts} />
      </SectionBody>
    </Section>
  );
}
