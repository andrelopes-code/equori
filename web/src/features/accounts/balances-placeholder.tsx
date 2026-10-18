import { Grid } from "@slotted/react/grid";
import { SkeletonRegion } from "@slotted/react/skeleton";
import {
  StatCard,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardValue,
} from "@slotted/react/stat-card";

// Two groups is the smallest set a ledger with a card holds; more groups grow the region.
const groups = [0, 1];

export function BalancesPlaceholder({
  columns,
  size,
  minItemWidth,
}: {
  columns: 2 | 4;
  size: "sm" | "md";
  minItemWidth: "xs" | "sm";
}) {
  return (
    <SkeletonRegion>
      <Grid
        columns={columns}
        gap={size === "sm" ? 3 : 4}
        minItemWidth={minItemWidth}
      >
        {groups.map((n) => (
          <StatCard key={n} size={size} loading>
            <StatCardHeader>
              <StatCardLabel />
            </StatCardHeader>
            <StatCardFigure>
              <StatCardValue />
            </StatCardFigure>
          </StatCard>
        ))}
      </Grid>
    </SkeletonRegion>
  );
}
