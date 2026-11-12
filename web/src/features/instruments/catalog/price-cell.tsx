import { Text } from "@slotted/react/typography";

import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import { formatPrice } from "@/features/instruments/model/rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface PriceCellProps {
  row: CatalogRow;
  // The read of the quotes failed (IQ11).
  failed: boolean;
}

// The latest price of a row. A unit price is masked like the average cost of a position
// (positions-tab.tsx). A currency quoted in the base has no price of its own.
export function PriceCell({ row, failed }: PriceCellProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  if (row.priceQuote === "") return null;

  if (failed)
    return (
      <Text size="sm" tone="muted">
        {t("instruments.price.loadFailed")}
      </Text>
    );

  if (row.lastValue === "")
    return (
      <Text size="sm" tone="muted">
        {t("instruments.noPrice")}
      </Text>
    );

  return fmt.hidden ? MASK : formatPrice(row.lastValue, locale);
}
