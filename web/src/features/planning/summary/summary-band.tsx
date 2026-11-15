import { Skeleton } from "@slotted/react/skeleton";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import { BandValue } from "@/features/planning/summary/band-value";
import styles from "@/features/planning/summary/summary-band.module.css";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import type { MoneyAmount } from "@/ui/money/money-value";

export interface SummaryFigure {
  key: string;
  label: string;
  // Text as written, or an amount drawn with its symbol and fraction apart.
  value: string | (MoneyAmount & { signed?: boolean }) | undefined;
  note: ReactNode;
  // A part of a whole drawn beside the note: what came in of what was expected.
  meter?: { value: number; max: number } | undefined;
}

interface SummaryBandProps {
  label: string;
  figures: readonly SummaryFigure[];
  loading: boolean;
}

// The row of figures a planning tab opens with (spec P1): one frame, the conclusion first and
// wider, each figure over its note, a part of a whole as a thin bar beside the note.
// Built here: stat-card draws a card per figure and keeps its trend slot for a sparkline; a
// progress bar placed there ignores the card's padding, and no family draws one framed row of
// figures with a focal one.
export function SummaryBand({ label, figures, loading }: SummaryBandProps) {
  const [locale] = useAppLocale();

  return (
    <section aria-label={label} className={styles.band}>
      {figures.map((figure, index) => {
        const share =
          figure.meter === undefined || figure.meter.max <= 0
            ? undefined
            : Math.round((figure.meter.value * 10000) / figure.meter.max);
        return (
          <div
            key={figure.key}
            className={styles.cell}
            data-focal={index === 0 ? "" : undefined}
          >
            <Text size="xs" tone="muted" className={styles.label}>
              {figure.label}
            </Text>
            {loading || figure.value === undefined ? (
              <Skeleton className={styles.placeholder} />
            ) : (
              <BandValue value={figure.value} focal={index === 0} />
            )}
            <span className={styles.foot}>
              {share !== undefined && (
                <span
                  className={styles.meter}
                  role="img"
                  aria-label={formatBasisPoints(share, locale)}
                >
                  <i
                    style={{
                      inlineSize: `${String(Math.min(share, 10000) / 100)}%`,
                    }}
                  />
                </span>
              )}
              <Text size="xs" tone="muted" className={styles.note}>
                {figure.note}
              </Text>
            </span>
          </div>
        );
      })}
    </section>
  );
}
