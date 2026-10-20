import {
  StatCard,
  StatCardComparison,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardValue,
} from "@slotted/react/stat-card";

import styles from "@/features/admin/figure-tile.module.css";

export function FigureTile({
  label,
  value,
  comparison,
  size = "sm",
  loading = false,
}: {
  label: string;
  // Undefined once loaded draws the card's empty state.
  value: string | undefined;
  comparison?: string | undefined;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  return (
    <div className={styles.cell}>
      <StatCard
        size={size}
        loading={loading}
        status={!loading && value === undefined ? "empty" : "ready"}
      >
        <StatCardHeader>
          <StatCardLabel>{label}</StatCardLabel>
        </StatCardHeader>
        <StatCardFigure>
          <StatCardValue value={value} />
          {comparison !== undefined && (
            <StatCardComparison>{comparison}</StatCardComparison>
          )}
        </StatCardFigure>
      </StatCard>
    </div>
  );
}
