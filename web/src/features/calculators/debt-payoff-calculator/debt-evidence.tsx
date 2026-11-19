import { Field } from "@slotted/react/field";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionTitle,
} from "@slotted/react/section";

import { CalcTable } from "@/features/calculators/calculator-frame/calc-table";
import { SplitBars } from "@/features/calculators/calculator-frame/split-bars";
import type { DebtAnswer } from "@/features/calculators/debt-payoff-calculator/debt-answer";
import type { Debt } from "@/features/calculators/debt-payoff-calculator/debt-math";
import type { PayoffPlan } from "@/features/calculators/debt-payoff-calculator/debt-math";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";

interface DebtEvidenceProps {
  money: CalculatorMoney;
  answer: Extract<DebtAnswer, { kind: "solved" | "open" }>;
  debts: readonly Debt[];
}

export function DebtEvidence({ money, answer, debts }: DebtEvidenceProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const count = numberFormatter(tag);
  const orders = [
    { name: t("calc.debt.avalanche"), plan: answer.avalanche },
    { name: t("calc.debt.snowball"), plan: answer.snowball },
  ];
  const help = [
    `${orders[0]?.name ?? ""}: ${t("calc.debt.avalanche.help")}`,
    `${orders[1]?.name ?? ""}: ${t("calc.debt.snowball.help")}`,
  ].join(" ");
  const closed = (plan: PayoffPlan | null, name: string) =>
    plan === null
      ? t("calc.debt.notClosedCell")
      : count.format(plan.closed.find((c) => c.name === name)?.month ?? 0);

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <Field necessity="none">
            <FieldTitle label={t("calc.debt.bars.title")} help={help} />
          </Field>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <SplitBars
          rows={orders.flatMap(({ name, plan }) => {
            if (plan === null) return [];
            const total = money.format(plan.interest);

            return [
              {
                name,
                parts: [plan.interest],
                total,
                label: `${name} ${total}`,
              },
            ];
          })}
        />

        <CalcTable
          ruled
          hideFirstHeader
          caption={t("calc.debt.compare")}
          headers={[t("calc.debt.figure"), ...orders.map((o) => o.name)]}
          rows={debts.map((d, i) => ({
            key: `close-${String(i)}`,
            cells: [
              t("calc.debt.closes", { name: d.name }),
              ...orders.map((o) => closed(o.plan, d.name)),
            ],
          }))}
        />
      </SectionBody>
    </Section>
  );
}
