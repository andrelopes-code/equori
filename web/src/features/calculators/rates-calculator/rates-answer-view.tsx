import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import { formatRate } from "@/features/calculators/model/format-rate";
import type { ratesAnswer } from "@/features/calculators/rates-calculator/rates-answer";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface RatesAnswerViewProps {
  answer: ReturnType<typeof ratesAnswer>;
  // The typed rate as a fraction; null while it is missing or invalid.
  rate: number | null;
  period: "month" | "year";
}

export function RatesAnswerView({
  answer,
  rate,
  period,
}: RatesAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { equivalent, real, ofIndex } = answer;
  const month = period === "month";

  const facts = [
    ...(real === null
      ? []
      : [{ term: t("calc.rates.real"), value: formatRate(real, tag) }]),
    ...(ofIndex === null
      ? []
      : [{ term: t("calc.rates.ofIndex"), value: formatRate(ofIndex, tag) }]),
  ];
  const lead = t(
    month ? "calc.rates.answer.leadYear" : "calc.rates.answer.leadMonth",
  );

  if (rate === null || equivalent === null)
    return (
      <CalculatorAnswer
        lead={lead}
        figure={null}
        sentence={
          missingSentence(
            [{ label: lowerFirst(t("calc.rates.rate"), tag), missing: true }],
            t("calc.rates.answer.what"),
            t,
            tag,
          ) ?? ""
        }
        facts={facts}
      />
    );

  return (
    <CalculatorAnswer
      lead={lead}
      figure={formatRate(equivalent, tag)}
      sentence={t(
        month
          ? "calc.rates.answer.sentenceYear"
          : "calc.rates.answer.sentenceMonth",
        {
          rate: formatRate(rate, tag),
          equivalent: formatRate(equivalent, tag),
        },
      )}
      facts={facts}
    />
  );
}
