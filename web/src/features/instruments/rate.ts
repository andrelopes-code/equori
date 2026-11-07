import { numberFormatter } from "@/i18n/format";

// A price is an exact decimal of at most 12 places (ADR 005); it travels as text, never as a float.
const rate = /^\d+(\.\d{1,12})?$/;

export function parseRate(text: string): string | null {
  const value = text.trim().replace(",", ".");
  if (!rate.test(value) || /^0+(\.0+)?$/.test(value)) return null;
  return value;
}

export function formatRate(value: string, locale: string): string {
  return value.replace(".", decimalSeparator(locale));
}

// A price on a screen that compares many: grouped, with at most four decimals. The exact decimal
// stays on the instrument's page and in every calculation.
export function formatPrice(value: string, locale: string): string {
  const [whole = "", fraction = ""] = value.split(".");
  const integer = numberFormatter(locale).format(Number(whole));
  const kept = fraction.slice(0, 4);

  return kept === "" ? integer : `${integer}${decimalSeparator(locale)}${kept}`;
}

function decimalSeparator(locale: string): string {
  return (
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? "."
  );
}
