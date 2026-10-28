import { useField } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useEffect } from "react";
import type { KeyboardEvent } from "react";

import { minorFromTyped } from "@/ui/money-entry";
import styles from "@/ui/money-input.module.css";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The integer part of a safe integer: fifteen digits stay exact in a double.
const maxDigits = 15;

// Families read: currency-field, number-field. The currency field draws a plain input; money is
// what this application is about, so its entry is the app's own: the
// amount is the page's largest figure, signed and coloured by the kind of entry, typed like a
// till (money-entry.ts) and held as an integer of minor units (O7).
export function MoneyInput({
  value,
  onChange,
  currency,
  scale,
  sign,
  autoFocus = false,
  size = "panel",
  "aria-label": ariaLabel,
  invalid,
  readOnly,
  onKeyDown,
}: {
  // Minor units, at least zero; the sign belongs to the entry's kind.
  value: number;
  onChange: (minor: number) => void;
  currency: string;
  scale: number;
  sign: "expense" | "income" | "neutral";
  autoFocus?: boolean;
  // field: a control as tall as the text fields beside it, for a form that asks for several
  // amounts at once, none of them the page's largest figure. It does not take autoFocus.
  size?: "panel" | "field";
  // The name of a field-sized input with no Field around it, such as a cell of a table.
  "aria-label"?: string;
  invalid?: boolean;
  readOnly?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const fmt = useMoneyFormat();
  const field = useField();
  const register = field?.registerControl;
  const inField = size === "field";
  useEffect(() => {
    // The text field registers itself with the field around it.
    if (!inField) register?.();
  }, [register, inField]);
  const parts = fmt.entry({ amount: value, currency }, scale);
  const marks = { expense: "−", income: "+", neutral: "" };
  const typed = (text: string) => {
    onChange(minorFromTyped(text, maxDigits));
  };
  const caretAtEnd = (input: HTMLInputElement) => {
    // Digits enter at the right: the caret waits at the end.
    requestAnimationFrame(() => {
      input.setSelectionRange(input.value.length, input.value.length);
    });
  };
  if (inField)
    return (
      <TextField
        inputMode="numeric"
        autoComplete="off"
        {...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })}
        {...(invalid === undefined ? {} : { invalid })}
        {...(readOnly === undefined ? {} : { readOnly })}
        {...(onKeyDown === undefined ? {} : { onKeyDown })}
        value={parts.integer + parts.fraction}
        start={marks[sign] + parts.symbol}
        onChange={(event) => {
          typed(event.target.value);
        }}
        onFocus={(event) => {
          caretAtEnd(event.currentTarget);
        }}
      />
    );
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
        {/* An instrument with no symbol of its own is named by the code on the right. */}
        {parts.symbol !== currency && (
          <span className={styles.symbol}>{parts.symbol}</span>
        )}
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
          typed(event.target.value);
        }}
        onFocus={(event) => {
          caretAtEnd(event.currentTarget);
        }}
      />
      <span className={styles.code} aria-hidden="true">
        {currency}
      </span>
    </label>
  );
}
