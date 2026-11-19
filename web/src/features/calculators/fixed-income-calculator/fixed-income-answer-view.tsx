import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import type { fixedIncomeAnswer } from "@/features/calculators/fixed-income-calculator/fixed-income-answer";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface FixedIncomeAnswerViewProps {
  money: CalculatorMoney;
  answer: ReturnType<typeof fixedIncomeAnswer>;
  // The inputs still missing, as lowercase labels.
  missing: { label: string; missing: boolean }[];
  days: number | null;
}

export function FixedIncomeAnswerView({
  money,
  answer,
  missing,
  days,
}: FixedIncomeAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const count = numberFormatter(tag);
  const lead = t("calc.fixedIncome.answer.lead");

  if (answer === null || days === null)
    return (
      <CalculatorAnswer
        lead={lead}
        figure={null}
        sentence={
          missingSentence(
            missing.map((m) => ({ ...m, label: lowerFirst(m.label, tag) })),
            t("calc.fixedIncome.answer.what"),
            t,
            tag,
          ) ?? ""
        }
      />
    );

  return (
    <CalculatorAnswer
      lead={lead}
      figure={money.format(answer.net)}
      sentence={t("calc.fixedIncome.answer.sentence", {
        days: count.format(days),
      })}
      facts={[
        {
          term: t("calc.fixedIncome.gross"),
          value: money.format(answer.gross),
        },
        ...(answer.redemption > 0
          ? [
              {
                term: t("calc.fixedIncome.redemption"),
                value: money.format(answer.redemption),
              },
            ]
          : []),
        { term: t("calc.fixedIncome.tax"), value: money.format(answer.tax) },
        {
          term: t("calc.fixedIncome.netRate"),
          value: formatRate(answer.netAnnualRate, tag),
        },
      ]}
    />
  );
}
