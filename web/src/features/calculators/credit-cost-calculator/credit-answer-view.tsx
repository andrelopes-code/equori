import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import type { CreditAnswer } from "@/features/calculators/credit-cost-calculator/credit-answer";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface CreditAnswerViewProps {
  money: CalculatorMoney;
  answer: CreditAnswer;
  // The inputs still missing.
  missing: { label: string; missing: boolean }[];
  // Minor units; null while the amount released is missing.
  released: number | null;
  installment: number | null;
  count: number | null;
}

export function CreditAnswerView({
  money,
  answer,
  missing,
  released,
  installment,
  count,
}: CreditAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const lead = t("calc.credit.annual");

  if (answer.kind === "order")
    return (
      <CalculatorAnswer
        lead={lead}
        figure={null}
        sentence={t("calc.credit.order")}
      />
    );

  if (answer.kind === "no_solution")
    return (
      <CalculatorAnswer
        lead={lead}
        figure={null}
        sentence={t("calc.credit.noSolution")}
      />
    );

  if (
    answer.kind === "missing" ||
    released === null ||
    installment === null ||
    count === null
  )
    return (
      <CalculatorAnswer
        lead={lead}
        figure={null}
        sentence={
          missingSentence(
            missing.map((m) => ({ ...m, label: lowerFirst(m.label, tag) })),
            t("calc.credit.answer.what"),
            t,
            tag,
          ) ?? ""
        }
      />
    );

  return (
    <CalculatorAnswer
      lead={lead}
      figure={formatRate(answer.annual, tag, { min: 2, max: 2 })}
      sentence={t("calc.credit.answer.sentence", {
        released: money.format(released),
        count: numberFormatter(tag).format(count),
        installment: money.format(installment),
      })}
      facts={[
        {
          term: t("calc.credit.monthly"),
          value: formatRate(answer.monthly, tag),
        },
        { term: t("calc.credit.paid"), value: money.format(answer.paid) },
        { term: t("calc.credit.released"), value: money.format(released) },
      ]}
    />
  );
}
