import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import { currentQuoteOf } from "@/features/portfolio/model/current-quote";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { staleSince } from "@/features/portfolio/model/portfolio-holdings";
import { useScale } from "@/features/setup";
import { formatDate, formatTime } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface HoldingValueCellProps {
  holding: Holding;
  valueIn: string;
  date: string;
}

// PC7: the amount, the words for a row without a price, and the date of a price grown old.
export function HoldingValueCell({
  holding,
  valueIn,
  date,
}: HoldingValueCellProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  if (holding.value === undefined)
    return (
      <Text size="sm" tone="muted">
        {t("positions.noPrice")}
      </Text>
    );

  const stale = staleSince(holding.position?.prices, date);
  const quote = currentQuoteOf(holding.position?.prices);

  return (
    <Inline gap={2} align="center" justify="end" wrap="nowrap">
      {stale !== undefined && (
        <Text size="sm" tone="warning">
          {t("positions.priceOf", { date: formatDate(stale, tag) })}
        </Text>
      )}
      {stale === undefined && quote !== undefined && (
        <Text size="sm" tone="info">
          {t(quote.open ? "holdings.quote.partial" : "holdings.quote.at", {
            time: formatTime(quote.at, tag),
          })}
        </Text>
      )}
      {fmt.money(
        { amount: holding.value, currency: valueIn },
        scale?.(valueIn) ?? 0,
      )}
    </Inline>
  );
}
