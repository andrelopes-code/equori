import { IconButton } from "@slotted/react/button";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Glyph, Icon } from "@slotted/react/icon";
import { TextField } from "@slotted/react/text-field";

import type { AmortizationDraft } from "@/features/instruments/terms/payments-draft";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";
import { FormRow } from "@/ui/form-layout/form-row";

interface AmortizationRowProps {
  row: AmortizationDraft;
  error: string | undefined;
  onChange: (row: AmortizationDraft) => void;
  onRemove: () => void;
}

// One return of principal: its date and its percent of the principal.
export function AmortizationRow({
  row,
  error,
  onChange,
  onRemove,
}: AmortizationRowProps) {
  const t = useT();

  return (
    <FormRow>
      <Field invalid={error !== undefined}>
        <FieldLabel>{t("terms.amortizationOn")}</FieldLabel>
        <DateInput
          name="amortization_on"
          value={row.paysOn}
          shortcuts={false}
          onChange={(paysOn) => {
            onChange({ ...row, paysOn });
          }}
        />
      </Field>

      <Field invalid={error !== undefined}>
        <FieldLabel>{t("terms.amortizationPercent")}</FieldLabel>
        <TextField
          name="amortization_percent"
          inputMode="decimal"
          value={row.percent}
          onChange={(event) => {
            onChange({ ...row, percent: event.target.value });
          }}
        />
        {error !== undefined && <FieldError>{error}</FieldError>}
      </Field>

      <IconButton
        size="sm"
        variant="ghost"
        tone="secondary"
        aria-label={t("terms.amortizationRemove")}
        onClick={onRemove}
      >
        <Icon>
          <Glyph name="trash" />
        </Icon>
      </IconButton>
    </FormRow>
  );
}
