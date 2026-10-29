import {
  StatCard,
  StatCardAction,
  StatCardComparison,
  StatCardDelta,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardMessage,
  StatCardTrend,
  StatCardValue,
} from "@slotted/react/stat-card";
import type { ReactNode } from "react";

import styles from "@/ui/figure-card.module.css";
import { MoneyValue } from "@/ui/money-value";
import type { MoneyAmount } from "@/ui/money-value";

// One figure of a page: a label, a value, the line that says what it counts, and optionally the
// change from the month before, a trend, and a door to the records.
export function FigureCard({
  label,
  value,
  note,
  action,
  delta,
  trend,
  goodWhen = "up",
  attention,
  loading = false,
}: {
  label: string;
  // Text as written, or an amount drawn with its symbol apart; undefined draws the family's empty state.
  value: string | MoneyAmount | undefined;
  note: ReactNode;
  action?: ReactNode;
  // A fraction: 0.124 reads "+12.4%".
  delta?: number | undefined;
  // A Sparkline of the figure's recent values.
  trend?: ReactNode;
  // "none" for a figure with no good direction.
  goodWhen?: "up" | "down" | "none";
  // A figure past a threshold the page states. The note says which one: colour is never the only
  // channel (OV-04).
  attention?: "warning" | "danger" | undefined;
  loading?: boolean;
}) {
  return (
    <StatCard
      size="sm"
      layout="stacked"
      loading={loading}
      status={!loading && value === undefined ? "empty" : "ready"}
      goodWhen={goodWhen}
      formatOptions={{ maximumFractionDigits: 1 }}
      className={styles.card}
      data-attention={attention}
      {...(delta === undefined ? {} : { delta })}
    >
      <StatCardHeader>
        <StatCardLabel>{label}</StatCardLabel>
        {action !== undefined && <StatCardAction>{action}</StatCardAction>}
      </StatCardHeader>
      <StatCardFigure>
        {typeof value === "object" ? (
          <MoneyValue {...value} />
        ) : (
          <StatCardValue value={value} />
        )}
        {delta !== undefined && <StatCardDelta />}
      </StatCardFigure>
      {trend !== undefined && <StatCardTrend>{trend}</StatCardTrend>}
      <StatCardComparison>{note}</StatCardComparison>
      {/* A card with no value drops the comparison; the same words stand as its message. */}
      <StatCardMessage>{note}</StatCardMessage>
    </StatCard>
  );
}
