import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { formatRate } from "@/features/instruments";
import { useBaseAmountPrefill } from "@/features/transactions/transaction-form/use-base-amount-prefill";
import { useStoredPrice } from "@/features/transactions/transaction-form/use-stored-price";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money/money-input";

type Account = components["schemas"]["Account"];

export interface BaseAmountFieldProps {
  account: Account | undefined;
  baseCurrency: string;
  scale: (code: string) => number;
  amount: number;
  date: string;
  value: number;
  typed: boolean;
  error: string | undefined;
  onChange: (value: number, typed: boolean) => void;
}

// The value of an entry in the base currency, asked when its account holds another currency: a
// transaction balances in the base currency (DM1). It follows the stored price until typed.
export function BaseAmountField({
  account,
  baseCurrency,
  scale,
  amount,
  date,
  value,
  typed,
  error,
  onChange,
}: BaseAmountFieldProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const currency =
    account === undefined || account.currency === baseCurrency
      ? null
      : account.currency;
  const { price, loaded } = useStoredPrice(currency, baseCurrency, date);

  useBaseAmountPrefill({
    rate: price?.value,
    amount,
    amountScale: scale(currency ?? baseCurrency),
    baseScale: scale(baseCurrency),
    value,
    typed,
    onPrefill: (next) => {
      onChange(next, false);
    },
  });

  if (currency === null) return null;

  return (
    <Field width="medium" required invalid={error !== undefined}>
      <FieldLabel>
        {t("entry.baseAmount", { currency: baseCurrency })}
      </FieldLabel>
      <MoneyInput
        size="field"
        value={value}
        currency={baseCurrency}
        scale={scale(baseCurrency)}
        sign="neutral"
        onChange={(next) => {
          onChange(next, true);
        }}
      />
      {error !== undefined && <FieldError>{error}</FieldError>}
      {price !== undefined && (
        <FieldDescription live="polite">
          {t("entry.baseAmount.priced", {
            date: formatDate(price.date, locale),
            code: currency,
            rate: formatRate(price.value, locale),
            currency: baseCurrency,
          })}
        </FieldDescription>
      )}
      {price === undefined && loaded && (
        <FieldDescription live="polite">
          {t("entry.baseAmount.unpriced", {
            code: currency,
            currency: baseCurrency,
            date: formatDate(date, locale),
          })}
        </FieldDescription>
      )}
    </Field>
  );
}
