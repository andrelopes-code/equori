import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Field, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";

import { AmountField } from "@/features/calculators/fields/amount-field";
import { RateField } from "@/features/calculators/fields/rate-field";
import { fixedIncomeRules } from "@/features/calculators/fixed-income-calculator/fixed-income-region";
import { BreakEvenList } from "@/features/calculators/indexer-comparison/break-even-list";
import { breakEvenItems } from "@/features/calculators/indexer-comparison/break-even-items";
import {
  compare,
  referenceOf,
} from "@/features/calculators/indexer-comparison/compare";
import { daysBetween } from "@/features/calculators/indexer-comparison/comparison-dates";
import { ComparisonNotes } from "@/features/calculators/indexer-comparison/comparison-notes";
import { ComparisonTable } from "@/features/calculators/indexer-comparison/comparison-table";
import { resolveSecurity } from "@/features/calculators/indexer-comparison/security-draft";
import { SecurityList } from "@/features/calculators/indexer-comparison/security-list";
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
import { DateInput } from "@/ui/form-fields/date-input";

interface IndexerComparisonProps {
  // The initial amount, in minor units of the currency.
  amount: number;
  currency: string;
}

// The comparison of fixed income securities by indexer (IC1 to IC5, IC13): two to six
// securities held to one maturity, their yields after tax under the expected path of each index,
// and the break-even of each floating one. The inputs live in this component's state.
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

  if (scaleOf === null) return null;
  const scale = scaleOf(currency);

  return (
    <Stack gap={5}>
      <AmountField
        label={t("calc.indexerComparison.amount")}
        value={draft.amount === 0 ? undefined : String(draft.amount)}
        money={{
          currency,
          scale,
          format: (amount) => fmt.money({ amount, currency }, scale),
        }}
        onChange={(minor) => {
          draft.setAmount(Number(minor ?? 0));
        }}
      />

      <Field necessity="none">
        <FieldLabel>{t("calc.indexerComparison.maturity")}</FieldLabel>
        <DateInput
          name="maturity"
          value={draft.maturity}
          min={today}
          onChange={draft.setMaturity}
        />
      </Field>

      {rules === null && (
        <RateField
          label={t("calc.fixedIncome.taxRate")}
          name="taxRate"
          value={draft.taxRate}
          onChange={draft.setTaxRate}
        />
      )}

      <SecurityList draft={draft} securities={securities} offered={indexes} />

      {early && (
        <Alert tone="warning">
          <AlertContent>
            <AlertDescription>{t("calc.fixedIncome.iof")}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {ready && (
        <>
          <ComparisonTable
            securities={securities}
            rows={rows}
            currency={currency}
            scale={scale}
          />

          <BreakEvenList
            items={items}
            securities={securities}
            reference={reference}
          />

          <ComparisonNotes />
        </>
      )}
    </Stack>
  );
}
