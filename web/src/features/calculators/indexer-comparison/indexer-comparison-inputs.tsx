import { Field, FieldLabel } from "@slotted/react/field";

import { AmountField } from "@/features/calculators/fields/amount-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { RateField } from "@/features/calculators/fields/rate-field";
import type { Security } from "@/features/calculators/indexer-comparison/security";
import { SecurityList } from "@/features/calculators/indexer-comparison/security-list";
import type { useComparisonDraft } from "@/features/calculators/indexer-comparison/use-comparison-draft";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";

interface IndexerComparisonInputsProps {
  draft: ReturnType<typeof useComparisonDraft>;
  money: CalculatorMoney;
  today: string;
  securities: readonly Security[];
  offered: readonly { id: string; period: "day" | "month" }[];
  // The region has no tax rule: the person types the rate.
  askTax: boolean;
}

export function IndexerComparisonInputs({
  draft,
  money,
  today,
  securities,
  offered,
  askTax,
}: IndexerComparisonInputsProps) {
  const t = useT();

  return (
    <>
      <AmountField
        label={t("calc.indexerComparison.amount")}
        width="medium"
        value={draft.amount === 0 ? undefined : String(draft.amount)}
        money={money}
        onChange={(minor) => {
          draft.setAmount(Number(minor ?? 0));
        }}
      />

      <Field necessity="none" width="medium">
        <FieldLabel>{t("calc.indexerComparison.maturity")}</FieldLabel>
        <DateInput
          name="maturity"
          value={draft.maturity}
          min={today}
          onChange={draft.setMaturity}
        />
      </Field>

      {askTax && (
        <RateField
          label={t("calc.fixedIncome.taxRate")}
          name="taxRate"
          value={draft.taxRate}
          onChange={draft.setTaxRate}
        />
      )}

      <SecurityList draft={draft} securities={securities} offered={offered} />
    </>
  );
}
