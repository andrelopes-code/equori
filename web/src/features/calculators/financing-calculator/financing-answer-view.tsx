import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import type { AmortizationRow } from "@/features/calculators/financing-calculator/annuity";
import {
  emptySentence,
  financingFacts,
} from "@/features/calculators/financing-calculator/financing-answer";
import type { readFinancing } from "@/features/calculators/financing-calculator/financing-input";
import { systemNames } from "@/features/calculators/financing-calculator/financing-region";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";

const whatKeys = {
  installment: "calc.financing.answer.what",
  amount: "calc.financing.answer.what.amount",
  rate: "calc.financing.answer.what.rate",
  months: "calc.financing.answer.what.months",
} as const;

interface FinancingAnswerViewProps {
  input: ReturnType<typeof readFinancing>;
  money: CalculatorMoney;
  // Null until the loan is complete and has a solution.
  schedules: { price: AmortizationRow[]; sac: AmortizationRow[] } | null;
}

export function FinancingAnswerView({
  input,
  money,
  schedules,
}: FinancingAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { locale } = useAppLocaleState();
  const names = systemNames(locale.region);
  const { solve, solved } = input;

  const solvedLead = {
    installment: t(names.installment),
    amount: t("calc.financing.solved.amount"),
    rate: t("calc.financing.solved.rate"),
    months: t("calc.financing.solved.months"),
  }[solve];

  if (schedules === null || solved === null) {
    const sentence = emptySentence({
      complete: input.complete,
      missing: input.missing,
      labels: {
        amount: t("calc.financing.amount"),
        rate: t("calc.financing.rate"),
        months: t("calc.term"),
        installment: t(names.installment),
      },
      what: t(whatKeys[solve]),
      noSolution: t("calc.financing.noSolution"),
      t,
      tag,
    });

    return (
      <CalculatorAnswer lead={solvedLead} figure={null} sentence={sentence} />
    );
  }

  const { price, sac } = schedules;
  const facts = financingFacts(price, sac);
  const figure = {
    installment: money.format(solved.installment),
    amount: money.format(solved.amount),
    rate: formatRate(solved.rate, tag, { min: 4 }),
    months: String(solved.months),
  }[solve];

  return (
    <CalculatorAnswer
      lead={solvedLead}
      figure={figure}
      sentence={t("calc.financing.answer.sentence", {
        months: String(solved.months),
        sacName: t(names.sac),
        sacFirst: money.format(sac[0]?.installment ?? 0),
        sacLast: money.format(sac.at(-1)?.installment ?? 0),
      })}
      facts={[
        { term: t("calc.financing.paid"), value: money.format(facts.paid) },
        {
          term: t("calc.financing.answer.interest"),
          value: money.format(facts.interest),
        },
        {
          term: t("calc.financing.answer.saved", { sacName: t(names.sac) }),
          value: money.format(facts.saved),
        },
      ]}
    />
  );
}
