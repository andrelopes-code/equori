import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Dated = readonly { date: string }[] | undefined;

// "Price of <date>" for the prices a value used, dated by the oldest: a value is as recent as
// its oldest input (an instrument's price and the exchange rate it went through). Empty without
// prices.
export function usePriceOf(): (prices: Dated) => string {
  const t = useT();
  const [locale] = useAppLocale();
  return (prices) => {
    const date = prices?.map((p) => p.date).sort()[0];
    return date === undefined
      ? ""
      : t("positions.priceOf", { date: formatDate(date, locale) });
  };
}

// Families read: stack, typography. A market value over the date of the prices it used, so a
// closing price is never read as a live quote.
export function PricedValue({
  value,
  prices,
}: {
  value: ReactNode;
  prices: Dated;
}) {
  const priceOf = usePriceOf()(prices);
  if (priceOf === "") return value;
  return (
    <Stack gap={0} align="end">
      {value}
      <Text size="sm" tone="muted">
        {priceOf}
      </Text>
    </Stack>
  );
}
