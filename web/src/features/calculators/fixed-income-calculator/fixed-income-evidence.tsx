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
import { splitParts } from "@/features/calculators/fixed-income-calculator/split-parts";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface FixedIncomeEvidenceProps {
  money: CalculatorMoney;
  answer: NonNullable<ReturnType<typeof fixedIncomeAnswer>>;
  exempt: boolean;
  // Basis points of the tax rate applied to the yield.
  taxBp: number;
  // Basis points of the redemption tax applied to the yield before the tax.
  redemptionBp: number;
}

export function FixedIncomeEvidence({
  money,
  answer,
  exempt,
  taxBp,
  redemptionBp,
}: FixedIncomeEvidenceProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const name = t("calc.fixedIncome.split.gross");
  const total = money.format(answer.gross);
  const split = splitParts(
    answer,
    {
      net: t("calc.fixedIncome.split.net"),
      tax: t("calc.fixedIncome.split.tax"),
      redemption: t("calc.fixedIncome.split.redemption"),
    },
    money.format,
  );

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
              parts: split.map((p) => p.value),
              total,
              label: `${name} ${total}: ${split.map((p) => p.label).join(", ")}`,
            },
          ]}
          legend={split.map((p) => p.name)}
        />

        <FactRows
          rows={[
            ...(exempt
              ? []
              : [
                  {
                    term: t("calc.fixedIncome.taxShare"),
                    value: formatRate(taxBp / 10000, tag),
                  },
                ]),
            ...(answer.redemption > 0
              ? [
                  {
                    term: t("calc.fixedIncome.redemptionShare"),
                    value: formatRate(redemptionBp / 10000, tag),
                  },
                ]
              : []),
            {
              term: t(
                exempt
                  ? "calc.fixedIncome.equivalentTaxable"
                  : "calc.fixedIncome.equivalentExempt",
              ),
              value: formatRate(answer.equivalent, tag),
            },
          ]}
        />
      </SectionBody>
    </Section>
  );
}
