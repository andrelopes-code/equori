import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import type { DebtAnswer } from "@/features/calculators/debt-payoff-calculator/debt-answer";
import styles from "@/features/calculators/debt-payoff-calculator/debt-answer-view.module.css";
import type { PayoffPlan } from "@/features/calculators/debt-payoff-calculator/debt-math";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface DebtAnswerViewProps {
  money: CalculatorMoney;
  answer: DebtAnswer;
  // The inputs still missing.
  missing: { label: string; missing: boolean }[];
}

export function DebtAnswerView({
  money,
  answer,
  missing,
}: DebtAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const lead = t("calc.debt.answer.leadEqual");
  const none = { lead, figure: null, sentence: "" };

  if (answer.kind === "missing")
    return (
      <CalculatorAnswer
        {...none}
        sentence={
          missingSentence(
            missing.map((m) => ({ ...m, label: lowerFirst(m.label, tag) })),
            t("calc.debt.answer.what"),
            t,
            tag,
          ) ?? ""
        }
      />
    );

  if (answer.kind === "below_minimums")
    return (
      <CalculatorAnswer {...none} sentence={t("calc.debt.belowMinimums")} />
    );

  const facts = lastPayments(answer, t, tag);

  if (answer.kind === "open")
    return (
      <div className={styles.area}>
        <CalculatorAnswer
          {...none}
          sentence={t("calc.debt.answer.open")}
          facts={facts}
        />

        <FormNotice tone="warning">{t("calc.debt.notClosed")}</FormNotice>
      </div>
    );

  if (answer.cheaper === "equal")
    return (
      <CalculatorAnswer
        lead={lead}
        figure={money.format(answer.avalanche.interest)}
        sentence={t("calc.debt.answer.equal")}
        facts={facts}
      />
    );

  const avalanche = answer.cheaper === "avalanche";
  const order = t(avalanche ? "calc.debt.avalanche" : "calc.debt.snowball");
  const other = t(avalanche ? "calc.debt.snowball" : "calc.debt.avalanche");
  const otherPlan = avalanche ? answer.snowball : answer.avalanche;

  return (
    <CalculatorAnswer
      lead={t("calc.debt.answer.lead", { order })}
      figure={money.format(answer.saving)}
      sentence={t("calc.debt.answer.sentence", {
        other: lowerFirst(other, tag),
        months: numberFormatter(tag).format(otherPlan.months),
      })}
      facts={facts}
    />
  );
}

// The month of the last payment of each order; a plan that never closes says so.
function lastPayments(
  plans: { avalanche: PayoffPlan | null; snowball: PayoffPlan | null },
  t: TFunction,
  tag: string,
): { term: string; value: string }[] {
  const count = numberFormatter(tag);
  const fact = (key: "avalanche" | "snowball") => ({
    term: t("calc.debt.answer.months", { order: t(`calc.debt.${key}`) }),
    value:
      plans[key] === null
        ? t("calc.debt.notClosedCell")
        : count.format(plans[key].months),
  });

  return [fact("avalanche"), fact("snowball")];
}
