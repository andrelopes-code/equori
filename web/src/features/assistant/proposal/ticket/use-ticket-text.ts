import type { components } from "@/api/schema.gen";
import { minorUnits } from "@/features/assistant/proposal/ticket/ticket-money";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { formatDate, formatWeekdayShort } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Value = components["schemas"]["AssistantValue"];

// The words of a ticket: an amount, a quantity with the locale's separators and masked with the
// amounts, a date after its weekday.
export function useTicketText() {
  const [locale] = useAppLocale();
  const money = useMoneyFormat();
  const value = useValueText();

  return {
    value,
    // The zeros that end a quantity carry no information ("10000.000000").
    quantity: ({ text = "" }: Value) => {
      const decimal = text.includes(".")
        ? text.replace(/0+$/, "").replace(/\.$/, "")
        : text;
      const { minor, scale } = minorUnits(decimal);

      return money.number({ amount: minor, currency: "" }, scale);
    },
    date: (iso: string) =>
      `${formatWeekdayShort(iso, locale)}, ${formatDate(iso, locale)}`,
  };
}
