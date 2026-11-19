import { CalculatorAnswer } from "@/features/calculators/calculator-frame/calculator-answer";
import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import type { IndexerAnswer } from "@/features/calculators/indexer-comparison/indexer-comparison-answer";
import styles from "@/features/calculators/indexer-comparison/indexer-comparison-answer-view.module.css";
import type { Security } from "@/features/calculators/indexer-comparison/security";
import { securityText } from "@/features/calculators/indexer-comparison/security-text";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface IndexerComparisonAnswerViewProps {
  // An amount in minor units, written with the currency.
  format: (minor: number) => string;
  answer: IndexerAnswer | null;
  securities: readonly Security[];
  // The inputs still missing.
  missing: { label: string; missing: boolean }[];
}

export function IndexerComparisonAnswerView({
  format,
  answer,
  securities,
  missing,
}: IndexerComparisonAnswerViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const rate = (value: number) => formatRate(value, tag, { min: 2, max: 2 });
  const neutral = t("calc.indexerComparison.answer.leadEqual");
  const winner =
    answer?.kind === "leader" ? securities[answer.winner] : undefined;
  const next = answer?.kind === "leader" ? securities[answer.next] : undefined;

  return (
    <div className={styles.area}>
      {answer?.kind === "leader" &&
        winner !== undefined &&
        next !== undefined && (
          <CalculatorAnswer
            lead={t("calc.indexerComparison.answer.lead", {
              name: securityText(winner, t, tag),
            })}
            figure={format(answer.final)}
            sentence={t("calc.indexerComparison.answer.sentence", {
              difference: format(answer.difference),
              next: securityText(next, t, tag),
            })}
            facts={[
              {
                term: t("calc.indexerComparison.col.netRate"),
                value: rate(answer.netRate),
              },
              ...(answer.breakEven === null
                ? []
                : [
                    {
                      term: t("calc.indexerComparison.breakEven.title"),
                      value: rate(answer.breakEven),
                    },
                  ]),
            ]}
          />
        )}

      {answer?.kind === "equal" && (
        <CalculatorAnswer
          lead={neutral}
          figure={format(answer.final)}
          sentence={t("calc.indexerComparison.answer.equal")}
          facts={[
            {
              term: t("calc.indexerComparison.col.netRate"),
              value: rate(answer.netRate),
            },
          ]}
        />
      )}

      {answer?.kind === "single" && (
        <CalculatorAnswer
          lead={neutral}
          figure={null}
          sentence={t("calc.indexerComparison.answer.single")}
        />
      )}

      {answer === null && (
        <CalculatorAnswer
          lead={neutral}
          figure={null}
          sentence={
            missingSentence(
              missing.map((m) => ({ ...m, label: lowerFirst(m.label, tag) })),
              t("calc.indexerComparison.answer.what"),
              t,
              tag,
            ) ?? ""
          }
        />
      )}
    </div>
  );
}
