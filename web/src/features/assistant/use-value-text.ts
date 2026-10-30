import type { components } from "@/api/schema.gen";
import { maskAmountText } from "@/features/assistant/mask-amounts";
import { formatDate } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Value = components["schemas"]["AssistantValue"];

// The text of one value of a proposal: an amount in the reader's format, a date in the locale's,
// any other text as the server wrote it, masked while privacy is on.
export function useValueText() {
  const [locale] = useAppLocale();
  const money = useMoneyFormat();

  return (value: Value | undefined): string | undefined => {
    if (value === undefined) return undefined;

    if (value.amount !== undefined && value.currency !== undefined) {
      const { minor, scale } = minorUnits(value.amount);
      return money.money({ amount: minor, currency: value.currency }, scale);
    }

    if (value.date !== undefined) return formatDate(value.date, locale);

    const text = value.text ?? "";

    return money.hidden ? maskAmountText(text) : text;
  };
}

// The decimal string of the API ("1234.56") becomes an integer and its scale by string
// manipulation (O7).
function minorUnits(amount: string): { minor: number; scale: number } {
  const [, fraction = ""] = amount.split(".");

  return { minor: Number(amount.replace(".", "")), scale: fraction.length };
}
