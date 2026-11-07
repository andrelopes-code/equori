import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import type { Holding } from "@/features/portfolio/portfolio-holdings";
import { staleSince } from "@/features/portfolio/portfolio-holdings";
import { useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
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

  return (
    <Inline gap={2} align="center" justify="end" wrap="nowrap">
      {stale !== undefined && (
        <Text size="sm" tone="warning">
          {t("positions.priceOf", { date: formatDate(stale, tag) })}
        </Text>
      )}
      {fmt.money(
        { amount: holding.value, currency: valueIn },
        scale?.(valueIn) ?? 0,
      )}
    </Inline>
  );
}
