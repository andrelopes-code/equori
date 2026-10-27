import {
  StatCard,
  StatCardComparison,
  StatCardDelta,
  StatCardFigure,
  StatCardMessage,
  StatCardValue,
} from "@slotted/react/stat-card";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block";

// One figure of the overview as a widget of its own: the widget's title is the figure's label
// and the widget is its only frame, so the card inside is plain and has no header (OV-05).
export function FigureWidget({
  placement,
  link,
  error,
  onRetry,
  loading,
  value,
  delta,
  goodWhen = "up",
  note,
  footer,
}: {
  placement: Placement;
  link?: { label: string; options: NavigateOptions } | undefined;
  error: Error | null;
  onRetry: () => void;
  loading: boolean;
  // Text as written; undefined draws the family's empty state.
  value: string | undefined;
  // A fraction: 0.124 reads "+12.4%".
  delta?: number | undefined;
  goodWhen?: "up" | "down" | "none";
  note: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <OverviewBlock
      placement={placement}
      link={link}
      loading={false}
      error={error}
      onRetry={onRetry}
      footer={footer}
    >
      <StatCard
        size="md"
        fill="plain"
        // Stacked keeps no empty trend column beside the figure.
        layout="stacked"
        loading={loading}
        status={!loading && value === undefined ? "empty" : "ready"}
        goodWhen={goodWhen}
        formatOptions={{ maximumFractionDigits: 1 }}
        {...(delta === undefined ? {} : { delta })}
      >
        <StatCardFigure>
          <StatCardValue value={value} />
          {delta !== undefined && <StatCardDelta />}
          {/* Inside the figure the comparison wraps to its own line under the value. */}
          <StatCardComparison>{note}</StatCardComparison>
        </StatCardFigure>
        {/* A card with no value drops the comparison; the same words stand as its message. */}
        <StatCardMessage>{note}</StatCardMessage>
      </StatCard>
    </OverviewBlock>
  );
}
