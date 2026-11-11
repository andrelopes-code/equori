import {
  StatCard,
  StatCardComparison,
  StatCardDelta,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardMessage,
  StatCardValue,
} from "@slotted/react/stat-card";

import type { PriceStats } from "@/features/instruments/model/price-stats";
import { usePriceFormat } from "@/features/instruments/model/use-price-format";
import styles from "@/features/instruments/quote/range-change.module.css";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface RangeChangeProps {
  stats: PriceStats | null;
  quote: string;
  loading: boolean;
}

// The change of the range is the figure the eye looks for first: the price it ends at, the
// change in the tone of its direction, and the dates it spans. It spans two columns of the grid.
export function RangeChange({ stats, quote, loading }: RangeChangeProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = usePriceFormat(quote);
  const change = stats?.changeBp ?? null;

  return (
    <StatCard
      size="lg"
      fill="subtle"
      goodWhen="up"
      formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      className={styles.change}
      loading={loading}
      status={!loading && stats === null ? "empty" : "ready"}
      {...(change === null ? {} : { delta: change / 10000 })}
    >
      <StatCardHeader>
        <StatCardLabel>{t("instrument.figures.change")}</StatCardLabel>
      </StatCardHeader>
      <StatCardFigure>
        <StatCardValue
          value={stats === null ? undefined : format.text(stats.last.value)}
        />
        {change !== null && <StatCardDelta />}
      </StatCardFigure>
      <StatCardComparison>{note(stats, locale, t)}</StatCardComparison>
      <StatCardMessage>{note(stats, locale, t)}</StatCardMessage>
    </StatCard>
  );
}

function note(
  stats: PriceStats | null,
  locale: string,
  t: ReturnType<typeof useT>,
): string {
  if (stats === null) return "";

  return t("instrument.figures.changeNote", {
    from: formatDate(stats.first.date, locale),
    to: formatDate(stats.last.date, locale),
  });
}
