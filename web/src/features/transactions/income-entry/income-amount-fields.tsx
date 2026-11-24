import { Field, FieldDescription, FieldError } from "@slotted/react/field";

import type { IncomeDraft } from "@/features/transactions/income-entry/income-draft";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

interface IncomeAmountFieldsProps {
  draft: IncomeDraft;
  base: string | undefined;
  baseScale: number;
  // The region withholds tax on the type of the draft.
  taxed: boolean;
  errors: Record<string, string>;
  onChange: (patch: Partial<IncomeDraft>) => void;
}

// The gross amount of an income and the tax withheld from it. A taxed type with nothing withheld
// says so, since the record takes the field as it stands.
export function IncomeAmountFields({
  draft,
  base,
  baseScale,
  taxed,
  errors,
  onChange,
}: IncomeAmountFieldsProps) {
  const t = useT();

  return (
    <FormRow>
      <Field required width="medium" invalid={errors.gross !== undefined}>
        <FieldTitle label={t("income.gross")} help={t("income.grossHelp")} />
        <MoneyInput
          size="field"
          value={draft.gross}
          currency={base ?? ""}
          scale={baseScale}
          sign="income"
          onChange={(gross) => {
            onChange({ gross });
          }}
        />
        {errors.gross !== undefined && <FieldError>{errors.gross}</FieldError>}
      </Field>

      <Field width="medium" invalid={errors.withheld !== undefined}>
        <FieldTitle
          label={t("income.withheld")}
          help={t("income.withheldHelp")}
        />
        <MoneyInput
          size="field"
          value={draft.withheld}
          currency={base ?? ""}
          scale={baseScale}
          sign="neutral"
          onChange={(withheld) => {
            onChange({ withheld });
          }}
        />
        {taxed && draft.withheld === 0 && (
          <FieldDescription>{t("income.noneWithheld")}</FieldDescription>
        )}
        {errors.withheld !== undefined && (
          <FieldError>{errors.withheld}</FieldError>
        )}
      </Field>
    </FormRow>
  );
}
