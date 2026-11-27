import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";

import { useT } from "@/i18n/i18n-provider";
import { PriceInput } from "@/ui/money/price-input";

interface ExchangeRateFieldProps {
  base: string | undefined;
  // The cash currency; the field draws only when it differs from the base.
  currency: string | undefined;
  // The canonical decimal; null takes the rate of the day.
  value: string | null;
  error: string | undefined;
  onChange: (rate: string | null) => void;
}

// The exchange rate of cash held in the quote currency of an instrument (FC2). Families read:
// field, text-field.
export function ExchangeRateField({
  base,
  currency,
  value,
  error,
  onChange,
}: ExchangeRateFieldProps) {
  const t = useT();

  if (base === undefined || currency === undefined || currency === base) {
    return null;
  }

  return (
    <Field width="medium" invalid={error !== undefined}>
      <FieldLabel>{t("trade.exchangeRate")}</FieldLabel>
      <PriceInput
        name="exchange_rate"
        value={value ?? ""}
        currency={base}
        invalid={error !== undefined}
        onChange={(rate) => {
          onChange(rate === "" ? null : rate);
        }}
      />
      <FieldDescription>
        {t("trade.exchangeRate.unit", { base, quote: currency })}
      </FieldDescription>
      <FieldDescription>{t("trade.exchangeRate.hint")}</FieldDescription>
      {error !== undefined && <FieldError>{error}</FieldError>}
    </Field>
  );
}
