import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import { useAppLocale } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import {
  editPriceText,
  formatPriceText,
  parsePriceText,
} from "@/ui/money/price-text";

interface PriceInputProps {
  // The canonical decimal ("1234.5"), or "" while there is no price.
  value: string;
  currency: string;
  // The canonical decimal of the typed text, or "" when the text is empty. A text that is not
  // a price yet ("300,") is kept and reported as nothing.
  onChange: (value: string) => void;
  name: string;
  invalid?: boolean;
  "aria-label"?: string;
}

// Families read: text-field. A unit price keeps up to 12 decimals (ADR 005), so it is not a
// MoneyInput of minor units: unfocused it is written in the locale's digits, focused it is the
// text the person types.
export function PriceInput({
  value,
  currency,
  onChange,
  name,
  invalid,
  "aria-label": ariaLabel,
}: PriceInputProps) {
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const [typed, setTyped] = useState<string | null>(null);

  const symbol = fmt.entry({ amount: 0, currency }, 0).symbol;
  const shown = typed ?? formatPriceText(value, locale);

  function handleChange(text: string) {
    setTyped(text);
    if (text.trim() === "") onChange("");
    const price = parsePriceText(text, locale);
    if (price !== null) onChange(price);
  }

  return (
    <TextField
      name={name}
      inputMode="decimal"
      autoComplete="off"
      {...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })}
      {...(invalid === undefined ? {} : { invalid })}
      value={shown}
      start={symbol}
      onFocus={() => {
        setTyped(editPriceText(value, locale));
      }}
      onBlur={() => {
        setTyped(null);
      }}
      onChange={(event) => {
        handleChange(event.target.value);
      }}
    />
  );
}
