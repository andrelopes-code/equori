import { numberFormatter } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import {
  priceAmount,
  priceDigits,
} from "@/features/instruments/model/price-stats";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";

export interface PriceFormat {
  // A unit price as exact decimal text, with the symbol of the quote currency.
  text: (value: string) => string;
  // A unit price the chart holds as a number, written with the same decimals.
  number: (value: number) => string;
  // A tick of the value axis: no symbol, as few decimals as the tick needs.
  tick: (value: number) => string;
}

// A unit price is masked with the amounts (IP15). The symbol and the separators come from the
// quote currency of the record and the active tag.
export function usePriceFormat(quote: string): PriceFormat {
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const text = (value: string) => {
    const digits = priceDigits(value);

    return fmt.money(
      { amount: priceAmount(value, digits), currency: quote },
      digits,
    );
  };

  return {
    text,
    number: (value) => text(plain(value)),
    tick: (value) =>
      fmt.hidden
        ? MASK
        : numberFormatter(locale, {
            maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
          }).format(value),
  };
}

// A number as the decimal text a price travels as, with no exponent.
function plain(value: number): string {
  return value.toFixed(8).replace(/(\.\d{2}\d*?)0+$/, "$1");
}
