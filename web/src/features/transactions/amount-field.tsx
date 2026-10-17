import { CurrencyField } from "@slotted/react/currency-field";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import { formatPlain } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";

// The family holds major units; the form holds the integer minor units of request.minorUnits.
export function AmountField({
  label,
  currency,
  scale,
  value,
  error,
  onChange,
}: {
  label: string;
  currency: string;
  scale: number;
  value: number | null;
  error: string | undefined;
  onChange: (minor: number | null) => void;
}) {
  const [locale] = useAppLocale();
  return (
    <Field invalid={error !== undefined}>
      <FieldLabel>{label}</FieldLabel>
      <CurrencyField
        allowEmpty
        inputMode="decimal"
        currency={currency}
        fractionDigits={scale}
        locale={locale}
        min={0}
        value={value === null ? null : Number(formatPlain(value, scale))}
        onValueChange={(next, request) => {
          onChange(next === null ? null : request.minorUnits);
        }}
      />
      {error !== undefined && <FieldError>{error}</FieldError>}
    </Field>
  );
}
