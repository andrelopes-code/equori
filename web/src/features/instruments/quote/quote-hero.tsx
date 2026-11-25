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

import { sourceLabel } from "@/features/instruments/model/instrument-labels";
import type { QuoteReading } from "@/features/instruments/quote/quote-reading";
import { usePriceFormat } from "@/features/instruments/model/use-price-format";
import { formatDate, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { TitleTag } from "@/ui/display/title-tag";

interface QuoteHeroProps {
  reading: QuoteReading | null;
  quote: string;
  loading: boolean;
  stale: boolean;
}

// Q1: the price now, its date and source, and its change. While the chart is read at a point, the
// hero reads that point against the start of the range (IP3).
export function QuoteHero({ reading, quote, loading, stale }: QuoteHeroProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = usePriceFormat(quote);
  const change = reading?.changeBp ?? null;

  return (
    <StatCard
      size="lg"
      fill="plain"
      goodWhen="none"
      loading={loading}
      status={!loading && reading === null ? "empty" : "ready"}
      {...(change === null ? {} : { delta: change / 10000 })}
    >
      <StatCardHeader>
        <StatCardLabel>
          {reading === null
            ? t("instrument.quote.label")
            : t("instrument.quote.latest", {
                date: formatDate(reading.price.date, locale),
                source: sourceLabel(t, reading.price.source),
              })}
          {stale && (
            <TitleTag tone="warning" className="ms-4">
              {t("instrument.quote.stale")}
            </TitleTag>
          )}
        </StatCardLabel>
      </StatCardHeader>
      <StatCardFigure>
        <StatCardValue>
          {reading === null ? "" : format.text(reading.price.value)}
        </StatCardValue>
        {change !== null && (
          <StatCardDelta>
            {formatSignedBasisPoints(change, locale)}
          </StatCardDelta>
        )}
        {reading !== null && (
          <StatCardComparison>
            {reading.reference === null
              ? t(
                  reading.basis === "start"
                    ? "instrument.quote.rangeStart"
                    : "instrument.quote.firstQuote",
                )
              : t(
                  reading.basis === "previous"
                    ? "instrument.quote.vsPrevious"
                    : "instrument.quote.sinceStart",
                  { date: formatDate(reading.reference.date, locale) },
                )}
          </StatCardComparison>
        )}
      </StatCardFigure>
      <StatCardMessage>{t("instrument.quote.none")}</StatCardMessage>
    </StatCard>
  );
}
