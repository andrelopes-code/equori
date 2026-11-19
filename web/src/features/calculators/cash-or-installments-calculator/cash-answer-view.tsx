import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import type { CashAnswer } from "@/features/calculators/cash-or-installments-calculator/cash-answer";
import styles from "@/features/calculators/cash-or-installments-calculator/cash-answer-view.module.css";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import { monthlyToAnnual } from "@/features/calculators/model/rate-math";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface CashAnswerViewProps {
  money: CalculatorMoney;
  // Null while the cash price, the count or the installment is missing.
  answer: CashAnswer | null;
  // The comparison rate per month; null while it is missing.
  compareMonthly: number | null;
  // The inputs still missing.
  missing: { label: string; missing: boolean }[];
}

export function CashAnswerView({
  money,
  answer,
  compareMonthly,
  missing,
}: CashAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { comparison, implied } = answer ?? { comparison: null, implied: null };
  const noRate = answer !== null && typeof implied !== "number";
  const notice = noRate
    ? t(
        implied === "no_interest"
          ? "calc.cash.noInterest"
          : "calc.cash.noSolution",
      )
    : null;

  if (comparison === null || compareMonthly === null) {
    // Without a comparison, the message of the implied rate is the sentence.
    const sentence =
      notice ??
      missingSentence(
        missing.map((m) => ({ ...m, label: lowerFirst(m.label, tag) })),
        t("calc.cash.answer.what"),
        t,
        tag,
      ) ??
      "";

    return (
      <div className={styles.area}>
        <CalculatorAnswer
          lead={t("calc.cash.answer.lead")}
          figure={null}
          sentence={sentence}
        />
      </div>
    );
  }

  const lead = {
    cash: "calc.cash.answer.leadCash",
    installments: "calc.cash.answer.leadInstallments",
    equal: "calc.cash.answer.leadEqual",
  } as const;
  const rates =
    typeof implied === "number"
      ? [
          { term: t("calc.cash.monthly"), value: formatRate(implied, tag) },
          {
            term: t("calc.cash.annual"),
            value: formatRate(monthlyToAnnual(implied), tag),
          },
        ]
      : [];

  return (
    <div className={styles.area}>
      <CalculatorAnswer
        lead={t(lead[comparison.cheaper])}
        figure={money.format(comparison.difference)}
        sentence={t("calc.cash.answer.sentence", {
          rate: formatRate(compareMonthly, tag),
        })}
        facts={[
          ...rates,
          {
            term: t("calc.cash.presentValue"),
            value: money.format(comparison.presentValue),
          },
        ]}
      />

      {notice !== null && (
        <FormNotice tone={implied === "no_interest" ? "info" : "warning"}>
          {notice}
        </FormNotice>
      )}
    </div>
  );
}
