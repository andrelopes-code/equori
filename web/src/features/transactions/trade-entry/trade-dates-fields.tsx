import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";

import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";
import { FormRow } from "@/ui/form-layout/form-row";

interface TradeDatesFieldsProps {
  draft: TradeDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<TradeDraft>) => void;
}

// The date of the trade and the optional day its cash settles (A228 IO6). Families read: field,
// date-picker.
export function TradeDatesFields({
  draft,
  errors,
  onChange,
}: TradeDatesFieldsProps) {
  const t = useT();

  return (
    <FormRow>
      <Field required invalid={errors.date !== undefined}>
        <FieldLabel>{t("entry.date")}</FieldLabel>
        <DateInput
          name="date"
          value={draft.date}
          // A settlement chosen for another trade date could fall before the new one; the
          // exchange's cycle takes over (A228 IO7).
          onChange={(date) => {
            onChange({ date, settlementDate: null });
          }}
        />
        {errors.date !== undefined && <FieldError>{errors.date}</FieldError>}
      </Field>

      <Field invalid={errors.settlement_date !== undefined}>
        <FieldLabel>{t("trade.settlementDate")}</FieldLabel>
        <DateInput
          name="settlement_date"
          value={draft.settlementDate ?? ""}
          min={draft.date}
          shortcuts={false}
          clearable
          onChange={(date) => {
            onChange({ settlementDate: date === "" ? null : date });
          }}
        />
        <FieldDescription>{t("trade.settlementHelp")}</FieldDescription>
        {errors.settlement_date !== undefined && (
          <FieldError>{errors.settlement_date}</FieldError>
        )}
      </Field>
    </FormRow>
  );
}
