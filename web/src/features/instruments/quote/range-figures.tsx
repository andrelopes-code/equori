import type { PriceStats } from "@/features/instruments/model/price-stats";
import { usePriceFormat } from "@/features/instruments/model/use-price-format";
import {
  formatDate,
  formatSignedBasisPoints,
  numberFormatter,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";

interface RangeFiguresProps {
  stats: PriceStats | null;
  quote: string;
  interval: string;
  loading: boolean;
}

// IP7: while loading, stats is null; the change, the high, the low and the number of points of the range on the chart.
export function RangeFigures({
  stats,
  quote,
  interval,
  loading,
}: RangeFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = usePriceFormat(quote);
  const change = stats?.changeBp ?? null;

  return (
    <FigureGrid label={t("instrument.figures.label")}>
      <FigureCard
        label={t("instrument.figures.change")}
        loading={loading}
        value={
          stats === null || change === null
            ? undefined
            : formatSignedBasisPoints(change, locale)
        }
        note={
          stats === null
            ? ""
            : t("instrument.figures.changeNote", {
                from: formatDate(stats.first.date, locale),
                to: formatDate(stats.last.date, locale),
              })
        }
      />
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
      <FigureCard
        label={t("instrument.figures.points")}
        loading={loading}
        value={
          stats === null
            ? undefined
            : numberFormatter(locale).format(stats.count)
        }
        note={t(intervalNote(interval))}
      />
    </FigureGrid>
  );
}

function intervalNote(interval: string) {
  if (interval === "week") return "instrument.figures.pointsWeek";
  if (interval === "month") return "instrument.figures.pointsMonth";

  return "instrument.figures.pointsDay";
}
