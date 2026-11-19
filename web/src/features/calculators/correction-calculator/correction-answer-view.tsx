import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import { correctionAnswer } from "@/features/calculators/correction-calculator/correction-answer";
import styles from "@/features/calculators/correction-calculator/correction-answer-view.module.css";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatRate } from "@/features/calculators/model/format-rate";
import { indexName } from "@/features/calculators/rate-source/index-catalog";
import { formatReferenceMonth, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface CorrectionAnswerViewProps {
  money: CalculatorMoney;
  // The typed amount in minor units; null while it is missing.
  amount: number | null;
  // Null while the instance stores no index.
  index: { id: string; first: string; last: string } | undefined;
  from: string | null;
  to: string | null;
  status: "inside" | "order" | "range" | "unknown";
  answer: ReturnType<typeof correctionAnswer>;
}

export function CorrectionAnswerView({
  money,
  amount,
  index,
  from,
  to,
  status,
  answer,
}: CorrectionAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const lead = t("calc.correction.answer.lead");

  const missing = missingSentence(
    [
      {
        label: lowerFirst(t("calc.correction.amount"), tag),
        missing: amount === null,
      },
      {
        label: lowerFirst(t("calc.index"), tag),
        missing: index === undefined,
      },
    ],
    t("calc.correction.answer.what"),
    t,
    tag,
  );
  let sentence = missing ?? "";
  if (status === "order") sentence = t("calc.correction.order");
  else if (
    missing === null &&
    index !== undefined &&
    from !== null &&
    to !== null
  )
    sentence = t("calc.correction.answer.sentence", {
      from: formatReferenceMonth(from, tag),
      to: formatReferenceMonth(to, tag),
      index: indexName(index.id),
    });

  const facts =
    answer === null
      ? undefined
      : [
          {
            term: t("calc.correction.factor"),
            value: numberFormatter(tag, {
              minimumFractionDigits: 8,
              maximumFractionDigits: 8,
            }).format(1 + answer.change),
          },
          {
            term: t("calc.correction.percent"),
            value: formatRate(answer.change, tag),
          },
          {
            term: t("calc.correction.months"),
            value: numberFormatter(tag).format(answer.months),
          },
        ];
  const figure = answer === null ? null : money.format(answer.corrected);

  return (
    <div className={styles.area}>
      <CalculatorAnswer
        lead={lead}
        figure={figure}
        sentence={sentence}
        {...(facts === undefined ? {} : { facts })}
      />

      {status === "range" && index !== undefined && (
        <FormNotice tone="warning">
          {t("calc.correction.range", {
            first: formatReferenceMonth(index.first.slice(0, 7), tag),
            last: formatReferenceMonth(index.last.slice(0, 7), tag),
          })}
        </FormNotice>
      )}
    </div>
  );
}
