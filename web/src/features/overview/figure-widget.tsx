import {
  StatCard,
  StatCardComparison,
  StatCardDelta,
  StatCardFigure,
  StatCardMessage,
  StatCardTrend,
  StatCardValue,
} from "@slotted/react/stat-card";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block";
import { MoneyValue } from "@/ui/money-value";
import type { MoneyAmount } from "@/ui/money-value";

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
  trend,
  footer,
}: {
  placement: Placement;
  link?: { label: string; options: NavigateOptions } | undefined;
  error: Error | null;
  onRetry: () => void;
  loading: boolean;
  // Text as written, or an amount drawn with its symbol apart; undefined draws the family's empty state.
  value: string | MoneyAmount | undefined;
  // A fraction: 0.124 reads "+12.4%".
  delta?: number | undefined;
  goodWhen?: "up" | "down" | "none";
  note: ReactNode;
  // A Sparkline of the figure's recent values.
  trend?: ReactNode;
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
        // A trend sits beside the figure, inside the widget's height; with no trend, stacked keeps
        // no empty trend column.
        layout={trend === undefined ? "stacked" : "inline"}
        loading={loading}
        status={!loading && value === undefined ? "empty" : "ready"}
        goodWhen={goodWhen}
        formatOptions={{ maximumFractionDigits: 1 }}
        {...(delta === undefined ? {} : { delta })}
      >
        <StatCardFigure>
          {typeof value === "object" ? (
            <MoneyValue {...value} />
          ) : (
            <StatCardValue value={value} />
          )}
          {delta !== undefined && <StatCardDelta />}
          {/* Inside the figure the comparison wraps to its own line under the value. */}
          <StatCardComparison>{note}</StatCardComparison>
        </StatCardFigure>
        {trend !== undefined && <StatCardTrend>{trend}</StatCardTrend>}
        {/* A card with no value drops the comparison; the same words stand as its message. */}
        <StatCardMessage>{note}</StatCardMessage>
      </StatCard>
    </OverviewBlock>
  );
}
