import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import type { TermsDraft } from "@/features/instruments/terms/terms-draft";
import { useT } from "@/i18n/i18n-provider";
import { FormRow } from "@/ui/form-layout/form-row";

interface TermsRateFieldsProps {
  draft: TermsDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<TermsDraft>) => void;
}

export function TermsRateFields({
  draft,
  errors,
  onChange,
}: TermsRateFieldsProps) {
  const t = useT();

  return (
    <>
      <Field invalid={errors.index_id !== undefined}>
        <FieldLabel>{t("terms.index")}</FieldLabel>
        <TextField
          name="index_id"
          value={draft.index}
          maxLength={40}
          onChange={(event) => {
            onChange({ index: event.target.value.toLowerCase() });
          }}
        />
        {errors.index_id === undefined ? (
          <FieldDescription>{t("terms.indexHint")}</FieldDescription>
        ) : (
          <FieldError>{errors.index_id}</FieldError>
        )}
      </Field>

      <FormRow>
        <Field invalid={errors.percent_of_index_bp !== undefined} required>
          <FieldLabel>{t("terms.percentOfIndex")}</FieldLabel>
          <TextField
            name="percent_of_index"
            inputMode="decimal"
            value={draft.percent}
            onChange={(event) => {
              onChange({ percent: event.target.value });
            }}
          />
          {errors.percent_of_index_bp !== undefined && (
            <FieldError>{errors.percent_of_index_bp}</FieldError>
          )}
        </Field>

        <Field invalid={errors.spread_bp !== undefined} required>
          <FieldLabel>{t("terms.spread")}</FieldLabel>
          <TextField
            name="spread"
            inputMode="decimal"
            value={draft.spread}
            onChange={(event) => {
              onChange({ spread: event.target.value });
            }}
          />
          {errors.spread_bp !== undefined && (
            <FieldError>{errors.spread_bp}</FieldError>
          )}
        </Field>
      </FormRow>
    </>
  );
}
