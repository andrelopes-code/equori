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

// One figure of the categories page: a label, a value, the line that says what it counts, and
// optionally the change from the month before and a door to the records.
export function FigureCard({
  label,
  value,
  note,
  action,
  delta,
  trend,
  goodWhen = "up",
  loading = false,
}: {
  label: string;
  // Text as written; undefined draws the family's empty state.
  value: string | undefined;
  note: ReactNode;
  action?: ReactNode;
  // A fraction: 0.124 reads "+12.4%".
  delta?: number | undefined;
  // A Sparkline of the figure's recent values.
  trend?: ReactNode;
  // "none" for a figure with no good direction.
  goodWhen?: "up" | "down" | "none";
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
      {...(delta === undefined ? {} : { delta })}
    >
      <StatCardHeader>
        <StatCardLabel>{label}</StatCardLabel>
        {action !== undefined && <StatCardAction>{action}</StatCardAction>}
      </StatCardHeader>
      <StatCardFigure>
        <StatCardValue value={value} />
        {delta !== undefined && <StatCardDelta />}
      </StatCardFigure>
      {trend !== undefined && <StatCardTrend>{trend}</StatCardTrend>}
      <StatCardComparison>{note}</StatCardComparison>
      {/* A card with no value drops the comparison; the same words stand as its message. */}
      <StatCardMessage>{note}</StatCardMessage>
    </StatCard>
  );
}
