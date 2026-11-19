// The text of a rate field in the decimal separator of the locale; the address keeps the dot.
export function rateFieldValue(text: string | undefined, tag: string): string {
  if (text === undefined) return "";

  const separator = new Intl.NumberFormat(tag)
    .formatToParts(1.5)
    .find((part) => part.type === "decimal")?.value;

  return text.replace(/[.,]/, separator ?? ".");
}
