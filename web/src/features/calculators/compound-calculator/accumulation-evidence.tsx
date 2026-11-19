import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { SplitBars } from "@/features/calculators/calculator-frame/split-bars";
import { splitRow } from "@/features/calculators/compound-calculator/accumulation-figures";
import { CompoundRange } from "@/features/calculators/compound-calculator/compound-range";
import { TermIncomeRows } from "@/features/calculators/compound-calculator/term-income-rows";
import type { AccumulationInput } from "@/features/calculators/compound-calculator/use-accumulation";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useT } from "@/i18n/i18n-provider";

interface AccumulationEvidenceProps {
  input: AccumulationInput;
  money: CalculatorMoney;
}

export function AccumulationEvidence({
  input,
  money,
}: AccumulationEvidenceProps) {
  const t = useT();
  const { run, range, volatility } = input;

  if (run === null) return null;

  const row = splitRow({
    name: t("calc.compound.final"),
    deposited: run.deposited,
    final: run.final,
    format: money.format,
    depositedLabel: t("calc.compound.chart.deposited"),
    interestLabel: t("calc.compound.interest"),
  });

  return (
    <>
      <Section size="lg">
        <SectionHeader>
          <SectionTitle>
            <SectionHeading>{t("calc.compound.split.title")}</SectionHeading>
          </SectionTitle>
        </SectionHeader>

        <SectionBody>
          <SplitBars
            rows={[row]}
            legend={[
              `${t("calc.compound.chart.deposited")} ${money.format(run.deposited)}`,
              `${t("calc.compound.interest")} ${money.format(run.final - run.deposited)}`,
            ]}
          />
        </SectionBody>
      </Section>

      {range !== null && volatility !== null && (
        <CompoundRange
          range={range}
          fixed={run.final}
          volatility={volatility}
          money={money}
        />
      )}

      <TermIncomeRows
        final={run.final}
        j={run.j}
        months={run.months}
        inflation={input.inflation}
        withdraw={input.withdraw}
        money={money}
      />
    </>
  );
}
