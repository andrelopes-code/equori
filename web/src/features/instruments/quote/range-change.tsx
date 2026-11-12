import {
  StatCard,
  StatCardComparison,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardMessage,
  StatCardValue,
} from "@slotted/react/stat-card";
import { Text } from "@slotted/react/typography";

import type { PriceStats } from "@/features/instruments/model/price-stats";
import { formatDate, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { directionOf, useAmountTone } from "@/ui/money/amount-tone";

interface RangeChangeProps {
  stats: PriceStats | null;
  loading: boolean;
}

// CA3: the price of the last quote is the hero's; this card writes the signed change of the range
// and the two dates it spans. StatCardValue takes no tone, so the change is a Text in the tone of
// its direction, the same tone helper the price table uses.
export function RangeChange({ stats, loading }: RangeChangeProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const amountTone = useAmountTone();
  const change = stats?.changeBp ?? null;
  const tone = amountTone("result", directionOf(change ?? 0));
  const note = stats === null ? "" : rangeNote(stats, locale, t);

  return (
    <StatCard
      size="sm"
      layout="stacked"
      loading={loading}
      status={!loading && stats === null ? "empty" : "ready"}
    >
      <StatCardHeader>
        <StatCardLabel>{t("instrument.figures.change")}</StatCardLabel>
      </StatCardHeader>
      <StatCardFigure>
        <StatCardValue>
          <Text size="xl" tone={tone}>
            {change === null ? "—" : formatSignedBasisPoints(change, locale)}
          </Text>
        </StatCardValue>
      </StatCardFigure>
      <StatCardComparison>{note}</StatCardComparison>
      <StatCardMessage>{note}</StatCardMessage>
    </StatCard>
  );
}

function rangeNote(
  stats: PriceStats,
  locale: string,
  t: ReturnType<typeof useT>,
): string {
  return t("instrument.figures.changeNote", {
    from: formatDate(stats.first.date, locale),
    to: formatDate(stats.last.date, locale),
  });
}
