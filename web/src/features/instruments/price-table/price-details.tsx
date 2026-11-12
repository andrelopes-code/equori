import type { components } from "@/api/schema.gen";
import { sourceLabel } from "@/features/instruments/model/instrument-labels";
import { priceStats } from "@/features/instruments/model/price-stats";
import { PriceLayer } from "@/features/instruments/price-table/price-layer";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

type Price = components["schemas"]["Price"];

interface PriceDetailsProps {
  prices: readonly Price[];
}

// L1: the summary line of the prices and the button of the layer that lists each date.
export function PriceDetails({ prices }: PriceDetailsProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const stats = priceStats(prices);

  if (stats === null) return null;

  return (
    <DetailDialog
      title={t("instrument.prices.caption")}
      description={t("instrument.prices.layer.description")}
      summary={t("instrument.prices.summary", {
        count: numberFormatter(locale).format(stats.count),
        from: formatDate(stats.first.date, locale),
        to: formatDate(stats.last.date, locale),
        source: sourceLabel(t, stats.last.source),
      })}
      triggerLabel={t("instrument.prices.open")}
    >
      <PriceLayer prices={prices} stats={stats} />
    </DetailDialog>
  );
}
