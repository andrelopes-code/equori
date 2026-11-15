import {
  StatCard,
  StatCardComparison,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardMessage,
  StatCardValue,
} from "@slotted/react/stat-card";
import type { ReactNode } from "react";

import styles from "@/features/planning/summary/summary-band.module.css";
import { MoneyValue } from "@/ui/money/money-value";
import type { MoneyAmount } from "@/ui/money/money-value";

export interface SummaryFigure {
  key: string;
  label: string;
  // Text as written, or an amount drawn with its symbol apart.
  value: string | (MoneyAmount & { signed?: boolean }) | undefined;
  note: ReactNode;
}

interface SummaryBandProps {
  label: string;
  figures: readonly SummaryFigure[];
  loading: boolean;
}

// The row of figures a planning tab opens with (spec P1): the first figure is the tab's
// conclusion, one type step above the others.
export function SummaryBand({ label, figures, loading }: SummaryBandProps) {
  return (
    <section aria-label={label} className={styles.band}>
      {figures.map((figure, index) => (
        <StatCard
          key={figure.key}
          size={index === 0 ? "md" : "sm"}
          layout="stacked"
          loading={loading}
          status={!loading && figure.value === undefined ? "empty" : "ready"}
        >
          <StatCardHeader>
            <StatCardLabel>{figure.label}</StatCardLabel>
          </StatCardHeader>
          <StatCardFigure>
            {typeof figure.value === "object" ? (
              <MoneyValue {...figure.value} />
            ) : (
              <StatCardValue value={figure.value} />
            )}
          </StatCardFigure>
          <StatCardComparison>{figure.note}</StatCardComparison>
          {/* A figure with no value drops the comparison; the same words stand as its message. */}
          <StatCardMessage>{figure.note}</StatCardMessage>
        </StatCard>
      ))}
    </section>
  );
}
