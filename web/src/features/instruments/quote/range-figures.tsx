import type { PriceStats } from "@/features/instruments/model/price-stats";
import { usePriceFormat } from "@/features/instruments/model/use-price-format";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { RangeChange } from "@/features/instruments/quote/range-change";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";

interface RangeFiguresProps {
  stats: PriceStats | null;
  quote: string;
  loading: boolean;
}

// IP7: while loading, stats is null; the change, the high and the low of the range.
export function RangeFigures({ stats, quote, loading }: RangeFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = usePriceFormat(quote);

  return (
    <FigureGrid label={t("instrument.figures.label")}>
      <RangeChange stats={stats} loading={loading} />
      <FigureCard
        label={t("instrument.figures.high")}
        loading={loading}
        value={stats === null ? undefined : format.text(stats.high.value)}
        note={stats === null ? "" : formatDate(stats.high.date, locale)}
      />
      <FigureCard
        label={t("instrument.figures.low")}
        loading={loading}
        value={stats === null ? undefined : format.text(stats.low.value)}
        note={stats === null ? "" : formatDate(stats.low.date, locale)}
      />
    </FigureGrid>
  );
}
