import type { PriceStats } from "@/features/instruments/model/price-stats";
import { usePriceFormat } from "@/features/instruments/model/use-price-format";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import styles from "@/ui/dialogs/detail-dialog.module.css";
import { FigureCard } from "@/ui/display/figure-card";

interface PriceFiguresProps {
  // Null while the prices load, and for a year without a price.
  stats: PriceStats | null;
  quote: string;
  loading: boolean;
}

// The strip of the prices layer: the count, the first and the last price, the high and the low.
export function PriceFigures({ stats, quote, loading }: PriceFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = usePriceFormat(quote);

  return (
    <div className={styles.strip}>
      <FigureCard
        label={t("instrument.prices.points")}
        loading={loading}
        value={stats ? numberFormatter(locale).format(stats.count) : undefined}
        note=""
      />

      <FigureCard
        label={t("instrument.prices.first")}
        loading={loading}
        value={stats ? formatDate(stats.first.date, locale) : undefined}
        note={stats ? format.text(stats.first.value) : ""}
      />

      <FigureCard
        label={t("instrument.prices.last")}
        loading={loading}
        value={stats ? formatDate(stats.last.date, locale) : undefined}
        note={stats ? format.text(stats.last.value) : ""}
      />

      <FigureCard
        label={t("instrument.prices.high")}
        loading={loading}
        value={stats ? format.text(stats.high.value) : undefined}
        note={stats ? formatDate(stats.high.date, locale) : ""}
      />

      <FigureCard
        label={t("instrument.prices.low")}
        loading={loading}
        value={stats ? format.text(stats.low.value) : undefined}
        note={stats ? formatDate(stats.low.date, locale) : ""}
      />
    </div>
  );
}
