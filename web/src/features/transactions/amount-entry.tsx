import { useField } from "@slotted/react/field";

import styles from "@/features/transactions/amount-entry.module.css";
import { formatMoney, formatMoneyParts } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";

// Longest run of digits kept: 15 stays below Number.MAX_SAFE_INTEGER.
const maxDigits = 15;

// Families read: currency-field, number-field. Both stop at the lg control step; the entry
// sheet sets the amount as its headline figure (complete frontend F1). Digits fill from the
// cents, as the currency field does: "12000" reads 120,00. Inside a Field it takes the
// field's identifier, description and invalid state.
export function AmountEntry({
  currency,
  scale,
  value,
  onChange,
}: {
  currency: string;
  scale: number;
  value: number | null;
  onChange: (minor: number | null) => void;
}) {
  const [locale] = useAppLocale();
  const field = useField();
  const symbol = formatMoneyParts(
    { amount: 0, currency },
    scale,
    locale,
  ).symbol;
  const text = (amount: number) =>
    formatMoney({ amount, currency }, scale, locale, { symbol: false });
  return (
    <span data-own="amount-entry" className={styles.entry}>
      <span aria-hidden="true" className={styles.symbol}>
        {symbol}
      </span>
      <input
        {...(field === undefined
          ? {}
          : {
              id: field.ids.control,
              "aria-describedby": field.describedBy,
              "aria-invalid": field.invalid === true ? true : undefined,
            })}
        className={styles.input}
        inputMode="numeric"
        autoComplete="off"
        placeholder={text(0)}
        value={value === null ? "" : text(value)}
        onChange={(event) => {
          const digits = event.target.value
            .replace(/\D/g, "")
            .slice(-maxDigits);
          onChange(digits === "" ? null : Number(digits));
        }}
      />
    </span>
  );
}
