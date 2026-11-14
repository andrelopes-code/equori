import { decimalText } from "@/features/transactions/model/decimal-text";
import { numberFormatter } from "@/i18n/format";

// Units of an instrument, in minor units of its scale, written with the locale's grouping.
export function formatUnits(
  amount: number,
  scale: number,
  locale: string,
): string {
  return numberFormatter(locale, {
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  }).format(Number(decimalText(amount, scale)));
}
