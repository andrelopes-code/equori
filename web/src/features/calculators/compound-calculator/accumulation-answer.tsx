import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import { missingSentence } from "@/features/calculators/calculator-frame/missing-fields";
import { waitingCost } from "@/features/calculators/compound-calculator/compound-answer";
import type { AccumulationInput } from "@/features/calculators/compound-calculator/use-accumulation";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AccumulationAnswerProps {
  input: AccumulationInput;
  money: CalculatorMoney;
}

export function AccumulationAnswer({ input, money }: AccumulationAnswerProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { target, months, annual, goal, run } = input;
  const what = t(
    target ? "calc.compound.target.what" : "calc.compound.answer.what",
  );

  if (run === null || months === null || annual === null) {
    const fields = [
      { label: t("calc.compound.target"), missing: target && goal === null },
      { label: t("calc.term"), missing: months === null },
      { label: t("calc.compound.rate"), missing: annual === null },
    ].map((f) => ({ ...f, label: f.label.toLocaleLowerCase(tag) }));

    return (
      <CalculatorAnswer
        lead={t(
          target ? "calc.compound.target.lead" : "calc.compound.mode.final",
        )}
        figure={null}
        sentence={missingSentence(fields, what, t, tag) ?? ""}
      />
    );
  }

  const result = run;
  const rate = `${formatRate(annual, tag)} ${t("calc.period.year")}`;
  const facts = [
    ...(target
      ? [
          {
            term: t("calc.compound.deposited"),
            value: money.format(result.deposited),
          },
          {
            term: t("calc.compound.interest"),
            value: money.format(result.final - result.deposited),
          },
        ]
      : []),
    ...(result.today === null
      ? []
      : [{ term: t("calc.compound.real"), value: money.format(result.today) }]),
    ...(result.delayed === null
      ? []
      : [
          {
            term: t("calc.compound.answer.delayed", {
              months: String(input.delay),
            }),
            value: money.format(result.delayed),
          },
          {
            term: t("calc.compound.answer.wait"),
            value: money.format(waitingCost(result.final, result.delayed)),
          },
        ]),
  ].slice(0, 3);

  if (target)
    return (
      <CalculatorAnswer
        lead={t("calc.compound.target.lead")}
        figure={money.format(result.deposit)}
        sentence={t("calc.compound.target.sentence", {
          target: money.format(result.final),
          months: String(months),
          rate,
        })}
        facts={facts}
      />
    );

  return (
    <CalculatorAnswer
      lead={t("calc.compound.answer.lead", { months: String(months) })}
      figure={money.format(result.final)}
      sentence={t("calc.compound.answer.sentence", {
        deposited: money.format(result.deposited),
        interest: money.format(result.final - result.deposited),
        rate,
      })}
      facts={facts}
    />
  );
}
