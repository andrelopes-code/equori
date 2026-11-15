import { numberFormatter } from "@/i18n/format";

// A price is an exact decimal of at most 12 places (ADR 005).
const canonical = /^\d+(\.\d{1,12})?$/;

// A canonical decimal ("1234.5") in the locale's digits ("1.234,5"). The integer part is grouped
// from a BigInt and the fraction is kept whole, so no float rounds the price (O7).
export function formatPriceText(value: string, locale: string): string {
  // A draft stored before prices were canonical holds the text the person typed.
  if (!canonical.test(value)) return value;

  const [whole = "0", fraction] = value.split(".");
  const integer = numberFormatter(locale).format(BigInt(whole));

  return fraction === undefined
    ? integer
    : `${integer}${decimalSeparator(locale)}${fraction}`;
}

// A canonical decimal as the text a person edits: the locale's decimal separator, no grouping.
export function editPriceText(value: string, locale: string): string {
  return value.replace(".", decimalSeparator(locale));
}

// The canonical decimal of what a person typed, or null when it is empty, zero, longer than
// 12 decimals or not a number. With both separators the locale's decimal separator is the
// decimal; with one kind the last one is the decimal and an earlier one is invalid.
export function parsePriceText(text: string, locale: string): string | null {
  const value = withDot(text.trim(), locale);
  if (value === null || !canonical.test(value)) return null;
  if (/^0+(\.0+)?$/.test(value)) return null;

  return value;
}

function withDot(typed: string, locale: string): string | null {
  const decimal = decimalSeparator(locale);
  const grouping = decimal === "." ? "," : ".";
  const separators = count(typed, ".") + count(typed, ",");
  const both = typed.includes(".") && typed.includes(",");
  if (separators > 1 && !both) return null;

  const dotted = both
    ? typed.split(grouping).join("").replace(decimal, ".")
    : typed.replace(",", ".");

  return dotted.startsWith(".") ? `0${dotted}` : dotted;
}

function count(text: string, character: string): number {
  return text.split(character).length - 1;
}

function decimalSeparator(locale: string): string {
  return (
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? "."
  );
}
