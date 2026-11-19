import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import { accumulationFacts } from "@/features/calculators/compound-calculator/accumulation-figures";
import { emptySentence } from "@/features/calculators/compound-calculator/compound-fields";
import type { AccumulationInput } from "@/features/calculators/compound-calculator/use-accumulation";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AccumulationAnswerProps {
  input: AccumulationInput;
  money: CalculatorMoney;
}

export function AccumulationAnswer({ input, money }: AccumulationAnswerProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const count = numberFormatter(tag);
  const { target, months, annual, goal, run } = input;

  if (run === null || months === null || annual === null) {
    const sentence = emptySentence({
      order: ["target", "term", "rate"],
      labels: {
        target: t("calc.compound.target"),
        term: t("calc.term"),
        rate: t("calc.compound.rate"),
      },
      missing: {
        target: target && goal === null,
        term: months === null,
        rate: annual === null,
      },
      what: t(
        target ? "calc.compound.target.what" : "calc.compound.answer.what",
      ),
      t,
      tag,
    });
    const lead = t(
      target ? "calc.compound.target.lead" : "calc.compound.mode.final",
    );

    return <CalculatorAnswer lead={lead} figure={null} sentence={sentence} />;
  }

  const rate = `${formatRate(annual, tag)} ${t("calc.period.year")}`;
  const facts = accumulationFacts({
    target,
    deposited: run.deposited,
    final: run.final,
    today: run.today,
    delayed: run.delayed,
    format: money.format,
    labels: {
      deposited: t("calc.compound.deposited"),
      interest: t("calc.compound.interest"),
      today: t("calc.compound.real"),
      delayed: t("calc.compound.answer.delayed", {
        months: count.format(input.delay ?? 0),
      }),
      wait: t("calc.compound.answer.wait"),
    },
  });

  if (target)
    return (
      <CalculatorAnswer
        lead={t("calc.compound.target.lead")}
        figure={money.format(run.deposit)}
        sentence={t("calc.compound.target.sentence", {
          target: money.format(goal ?? run.final),
          months: count.format(months),
          rate,
        })}
        facts={facts}
      />
    );

  return (
    <CalculatorAnswer
      lead={t("calc.compound.answer.lead", { months: count.format(months) })}
      figure={money.format(run.final)}
      sentence={t("calc.compound.answer.sentence", {
        deposited: money.format(run.deposited),
        interest: money.format(run.final - run.deposited),
        rate,
      })}
      facts={facts}
    />
  );
}
