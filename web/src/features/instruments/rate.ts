// A price is an exact decimal of at most 12 places (ADR 005); it travels as text, never as a float.
const rate = /^\d+(\.\d{1,12})?$/;

export function parseRate(text: string): string | null {
  const value = text.trim().replace(",", ".");
  if (!rate.test(value) || /^0+(\.0+)?$/.test(value)) return null;
  return value;
}

export function formatRate(value: string, locale: string): string {
  const separator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  return value.replace(".", separator);
}
