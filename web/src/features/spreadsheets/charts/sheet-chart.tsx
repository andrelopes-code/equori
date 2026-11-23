import { Chart } from "@slotted/react/chart";
import type { ReactNode } from "react";

import type {
  ChartKind,
  ChartTable,
} from "@/features/spreadsheets/charts/chart-table";
import styles from "@/features/spreadsheets/charts/sheet-chart.module.css";

interface SheetChartProps {
  kind: ChartKind;
  table: ChartTable;
  // The accessible name: the cells the chart reads.
  label: string;
  locale: string;
  size: "sm" | "md" | "lg";
  actions?: ReactNode;
}

const seriesKinds = {
  column: "bar",
  bar: "bar",
  line: "line",
  area: "area",
  pie: "pie",
} as const;

// The chart of a range of cells: columns, bars, a line or an area per series, or a pie of the
// first series.
export function SheetChart({
  kind,
  table,
  label,
  locale,
  size,
  actions,
}: SheetChartProps) {
  const drawn = kind === "pie" ? table.series.slice(0, 1) : table.series;
  const hasValue = table.records.some((record) =>
    drawn.some((s) => typeof record[s.field] === "number"),
  );

  return (
    <div className={styles.frame}>
      <Chart
        aria-label={label}
        variant="card"
        size={size}
        toolbar="none"
        locale={locale}
        orientation={kind === "bar" ? "horizontal" : "vertical"}
        trigger={kind === "pie" ? "item" : "axis"}
        data={hasValue ? table.records : []}
        series={drawn.map((s) => ({
          kind: seriesKinds[kind],
          field: s.field,
          label: s.label,
          ...(kind === "line" ? { markers: "all" as const } : {}),
        }))}
        x={{ field: "category" }}
        actions={actions}
      />
    </div>
  );
}
