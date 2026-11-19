import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import { fixedIncomeRules } from "@/features/calculators/fixed-income-calculator/fixed-income-region";
import { breakEvenItems } from "@/features/calculators/indexer-comparison/break-even-items";
import {
  compare,
  referenceOf,
} from "@/features/calculators/indexer-comparison/compare";
import { daysBetween } from "@/features/calculators/indexer-comparison/comparison-dates";
import { indexerAnswer } from "@/features/calculators/indexer-comparison/indexer-comparison-answer";
import { IndexerComparisonAnswerView } from "@/features/calculators/indexer-comparison/indexer-comparison-answer-view";
import { IndexerComparisonEvidence } from "@/features/calculators/indexer-comparison/indexer-comparison-evidence";
import { IndexerComparisonInputs } from "@/features/calculators/indexer-comparison/indexer-comparison-inputs";
import { resolveSecurity } from "@/features/calculators/indexer-comparison/security-draft";
import { taxBasis } from "@/features/calculators/indexer-comparison/tax-basis";
import {
  useComparableIndexes,
  useComparisonData,
} from "@/features/calculators/indexer-comparison/use-comparison-data";
import { useComparisonDraft } from "@/features/calculators/indexer-comparison/use-comparison-draft";
import { useScale } from "@/features/setup";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface IndexerComparisonProps {
  // The initial amount, in minor units of the currency.
  amount: number;
  currency: string;
}

// The comparison of fixed income securities by indexer (IC1 to IC5, IC13): two to six
// securities held to one maturity, their yields after tax under the expected path of each index,
// and the break-even of each floating one. The inputs live in this component's state (no address
// keys, CR17).
export function IndexerComparison({
  amount,
  currency,
}: IndexerComparisonProps) {
  const t = useT();
  const { locale: profile } = useAppLocaleState();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scaleOf = useScale();
  const indexes = useComparableIndexes(currency);
  const { data, curves } = useComparisonData(indexes);
  const draft = useComparisonDraft(amount, today);

  const rules = fixedIncomeRules(profile.region);
  const days = daysBetween(today, draft.maturity);
  const taxBp = taxBasis(rules, days, draft.taxRate);
  const securities = draft.rows.map((r) => resolveSecurity(r, indexes));
  const reference = referenceOf(securities);
  const early = rules !== null && days < rules.minimumDays;
  const ready = !early && draft.amount > 0 && days > 0 && taxBp !== null;
  const rows = ready
    ? compare({ amount: draft.amount, days, taxBp, securities, indexes: data })
    : [];
  const items = ready
    ? breakEvenItems({
        securities,
        reference,
        rows,
        indexes: data,
        curves,
        currency,
        maturity: draft.maturity,
        days,
        taxBp,
      })
    : [];
  const answer = ready
    ? indexerAnswer({
        amount: draft.amount,
        securities,
        rows,
        indexes: data,
        days,
        taxBp,
      })
    : null;

  if (scaleOf === null) return null;
  const scale = scaleOf(currency);
  const money = {
    currency,
    scale,
    format: (minor: number) => fmt.money({ amount: minor, currency }, scale),
  };

  return (
    <CalculatorFrame
      id="indexer-comparison"
      answer={
        <IndexerComparisonAnswerView
          format={money.format}
          answer={answer}
          securities={securities}
          early={early}
          missing={[
            {
              label: t("calc.indexerComparison.amount"),
              missing: draft.amount <= 0,
            },
            {
              label: t("calc.indexerComparison.maturity"),
              missing: days <= 0 || early,
            },
            {
              label: t("calc.fixedIncome.taxRate"),
              missing: rules === null && taxBp === null,
            },
            {
              label: t("calc.indexerComparison.rate"),
              missing: securities.every((s) => s.rate === null),
            },
          ]}
        />
      }
      evidence={
        ready ? (
          <IndexerComparisonEvidence
            securities={securities}
            rows={rows}
            items={items}
            reference={reference}
            currency={currency}
            scale={scale}
          />
        ) : undefined
      }
      inputs={
        <IndexerComparisonInputs
          draft={draft}
          money={money}
          today={today}
          securities={securities}
          offered={indexes}
          askTax={rules === null}
        />
      }
      method={
        <CalculatorMethod
          id="indexer-comparison"
          sources={rules?.sources ?? []}
        />
      }
    />
  );
}
