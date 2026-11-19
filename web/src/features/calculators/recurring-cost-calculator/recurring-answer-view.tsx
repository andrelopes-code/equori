import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import type {
  Per,
  RecurringAnswer,
} from "@/features/calculators/recurring-cost-calculator/recurring-answer";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface RecurringAnswerViewProps {
  money: CalculatorMoney;
  answer: RecurringAnswer;
  // The inputs still missing.
  missing: { label: string; missing: boolean }[];
  // Minor units; null while the amount is missing.
  amount: number | null;
  per: Per;
  years: number | null;
  // The annual rate as a fraction; null while the rate group is closed.
  rate: number | null;
}

export function RecurringAnswerView({
  money,
  answer,
  missing,
  amount,
  per,
  years,
  rate,
}: RecurringAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();

  if (answer.kind === "missing" || amount === null || years === null)
    return (
      <CalculatorAnswer
        lead={t("calc.recurring.total")}
        figure={null}
        sentence={
          missingSentence(
            missing.map((m) => ({ ...m, label: lowerFirst(m.label, tag) })),
            t("calc.recurring.answer.what"),
            t,
            tag,
          ) ?? ""
        }
      />
    );

  const parts = {
    amount: money.format(amount),
    per: t(
      per === "month"
        ? "calc.recurring.answer.perMonth"
        : "calc.recurring.answer.perYear",
    ),
  };
  const lead = t("calc.recurring.answer.lead", {
    years: numberFormatter(tag).format(years),
  });
  const total = money.format(answer.total);

  if (
    answer.futureValue === null ||
    answer.difference === null ||
    rate === null
  )
    return (
      <CalculatorAnswer
        lead={lead}
        figure={total}
        sentence={t("calc.recurring.answer.sentence", parts)}
      />
    );

  const future = money.format(answer.futureValue);

  return (
    <CalculatorAnswer
      lead={lead}
      figure={total}
      sentence={t("calc.recurring.answer.sentenceRate", {
        ...parts,
        rate: formatRate(rate, tag),
        future,
      })}
      facts={[
        { term: t("calc.recurring.futureValue"), value: future },
        {
          term: t("calc.recurring.difference"),
          value: money.format(answer.difference),
        },
      ]}
    />
  );
}
