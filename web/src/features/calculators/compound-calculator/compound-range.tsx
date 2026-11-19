import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { axisMax } from "@/features/calculators/calculator-frame/axis";
import { RangeStrip } from "@/features/calculators/calculator-frame/range-strip";
import { rangeOf } from "@/features/calculators/compound-calculator/accumulation-figures";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

const runs = 2000;

interface CompoundRangeProps {
  range: { p10: number; p50: number; p90: number };
  // The final amount at the fixed rate.
  fixed: number;
  // A yearly volatility as a fraction.
  volatility: number;
  money: CalculatorMoney;
}

export function CompoundRange({
  range,
  fixed,
  volatility,
  money,
}: CompoundRangeProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { low, mid, high } = rangeOf(range);

  const terms = [
    { term: t("calc.compound.range.low"), value: money.format(low) },
    { term: t("calc.compound.range.mid"), value: money.format(mid) },
    { term: t("calc.compound.range.high"), value: money.format(high) },
  ];

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {t("calc.compound.range.title", {
              volatility: formatRate(volatility, tag),
            })}
          </SectionHeading>
          <SectionDescription>
            {t("calc.compound.range.description", {
              runs: numberFormatter(tag).format(runs),
            })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <RangeStrip
          low={low}
          mid={mid}
          high={high}
          fixed={fixed}
          max={axisMax(Math.max(high, fixed))}
          label={terms.map((f) => `${f.term} ${f.value}`).join(", ")}
          legend={[
            t("calc.compound.range.band"),
            t("calc.compound.range.median"),
            t("calc.compound.range.fixed", { final: money.format(fixed) }),
          ]}
          facts={terms}
        />
      </SectionBody>
    </Section>
  );
}
