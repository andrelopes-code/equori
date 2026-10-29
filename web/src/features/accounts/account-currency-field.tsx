import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import widths from "@/ui/field-width.module.css";

interface AccountCurrencyFieldProps {
  mode: "create" | "edit";
  value: string;
  currencies: readonly string[];
  onChange: (currency: string) => void;
  error: string | undefined;
}

// The account's currency: chosen on create, read only on edit.
export function AccountCurrencyField({
  mode,
  value,
  currencies,
  onChange,
  error,
}: AccountCurrencyFieldProps) {
  const t = useT();

  return (
    <Field required invalid={error !== undefined}>
      <FieldLabel>{t("accountForm.currency")}</FieldLabel>
      {mode === "create" && (
        <ChoiceSelect
          label={t("accountForm.currency")}
          choices={currencies.map((c) => ({ value: c, label: c }))}
          value={value}
          multiple={false}
          className={widths.medium}
          onChange={(next) => {
            if (typeof next === "string") onChange(next);
          }}
        />
      )}
      {mode === "edit" && (
        <TextField value={value} readOnly className={widths.medium} />
      )}
      {error !== undefined && <FieldError>{error}</FieldError>}
      {mode === "edit" && (
        <FieldDescription>{t("accountForm.currencyFixed")}</FieldDescription>
      )}
    </Field>
  );
}
