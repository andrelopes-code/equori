import {
  DashboardGrid,
  type DashboardGridProps,
  usePersistedDashboardLayout,
} from "@slotted/react/dashboard-grid";

import {
  overviewLayoutKey,
  overviewLayoutStorage,
} from "@/theme/overview-layout";

type OverviewGridProps = Omit<DashboardGridProps, "layout" | "onLayoutChange">;

// The overview's grid in the layout kept with the member's appearance (analytics design 5.2).
// The hook reads storage once, at mount.
export function OverviewGrid(props: OverviewGridProps) {
  const persisted = usePersistedDashboardLayout({
    key: overviewLayoutKey,
    storage: overviewLayoutStorage,
  });

  return (
    <DashboardGrid
      {...props}
      layout={persisted.layout}
      onLayoutChange={persisted.onLayoutChange}
    />
  );
}
