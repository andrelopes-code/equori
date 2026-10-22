import { useField } from "@slotted/react/field";
import { useEffect } from "react";

import { formatMoneyParts } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { minorFromTyped } from "@/ui/money-entry";
import styles from "@/ui/money-input.module.css";

// The integer part of a safe integer: fifteen digits stay exact in a double.
const maxDigits = 15;

// Families read: currency-field, number-field. The currency field keeps a float in major units
// (Slotted finding "currency-field holds the amount as a float in major units") and draws a
// plain input; money is what this application is about, so its entry is the app's own: the
// amount is the page's largest figure, signed and coloured by the kind of entry, typed like a
// till (money-entry.ts) and held as an integer of minor units (O7).
export function MoneyInput({
  value,
  onChange,
  currency,
  scale,
  sign,
  autoFocus = false,
}: {
  // Minor units, at least zero; the sign belongs to the entry's kind.
  value: number;
  onChange: (minor: number) => void;
  currency: string;
  scale: number;
  sign: "expense" | "income" | "neutral";
  autoFocus?: boolean;
}) {
  const [locale] = useAppLocale();
  const field = useField();
  const register = field?.registerControl;
  useEffect(() => {
    register?.();
  }, [register]);
  const parts = formatMoneyParts({ amount: value, currency }, scale, locale);
  const marks = { expense: "−", income: "+", neutral: "" };
  return (
    // A label around the input: a press anywhere on the panel focuses it, as the platform
    // does for a label; the field's own label still names it through aria-labelledby.
    <label
      className={styles.panel}
      data-sign={sign}
      data-empty={value === 0 ? "" : undefined}
      data-invalid={field?.invalid === true ? "" : undefined}
    >
      <span className={styles.figure} aria-hidden="true">
        {marks[sign] !== "" && (
          <span className={styles.sign}>{marks[sign]}</span>
        )}
        <span className={styles.symbol}>{parts.symbol}</span>
      </span>
      <input
        id={field?.ids.control}
        aria-labelledby={field?.ids.label}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid === true ? true : undefined}
        className={styles.input}
        inputMode="numeric"
        autoComplete="off"
        // A new transaction starts at its amount; the page asks for it on purpose.
        autoFocus={autoFocus}
        value={parts.integer + parts.fraction}
        onChange={(event) => {
          onChange(minorFromTyped(event.target.value, maxDigits));
        }}
        onFocus={(event) => {
          const input = event.currentTarget;
          // Digits enter at the right: the caret waits at the end.
          requestAnimationFrame(() => {
            input.setSelectionRange(input.value.length, input.value.length);
          });
        }}
      />
      <span className={styles.code} aria-hidden="true">
        {currency}
      </span>
    </label>
  );
}
