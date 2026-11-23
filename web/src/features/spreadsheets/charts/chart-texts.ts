import type { ChartKind } from "@/features/spreadsheets/charts/chart-table";

// The words of a chart. The editor draws a chart outside the tree of the application, so the
// words reach it as values.
export interface ChartTexts {
  insert: string;
  insertTooltip: string;
  menu: string;
  kinds: Record<ChartKind, string>;
  useSelection: string;
  remove: string;
  label: (range: string) => string;
  seriesName: (position: number) => string;
}
