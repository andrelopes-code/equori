import { Text } from "@slotted/react/typography";

import type { LatestPrice } from "@/features/instruments/use-latest-prices";
import { formatRate } from "@/features/instruments/rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";

// A unit price is masked like the average cost of a position (positions-tab.tsx).
export function PriceCell({ latest }: { latest: LatestPrice | undefined }) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  if (latest === undefined || latest.pending) return null;
  if (latest.failed)
    return (
      <Text size="sm" tone="muted">
        {t("instruments.price.loadFailed")}
      </Text>
    );
  if (latest.price === null)
    return (
      <Text size="sm" tone="muted">
        {t("instruments.noPrice")}
      </Text>
    );
  return fmt.hidden ? MASK : formatRate(latest.price.value, locale);
}
