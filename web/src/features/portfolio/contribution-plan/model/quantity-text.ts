import { numberFormatter } from "@/i18n/format";

// The units of an order as the locale writes them, with the decimals the string carries.
export function quantityText(decimal: string, locale: string): string {
  const digits = decimal.split(".")[1]?.length ?? 0;

  return numberFormatter(locale, { maximumFractionDigits: digits }).format(
    Number(decimal),
  );
}
