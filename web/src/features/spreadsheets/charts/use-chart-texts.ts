import { useMemo } from "react";

import type { ChartTexts } from "@/features/spreadsheets/charts/chart-texts";
import { useT } from "@/i18n/i18n-provider";

// The words of the charts in the language of the application, one value per language.
export function useChartTexts(): ChartTexts {
  const t = useT();

  return useMemo(
    () => ({
      insert: t("spreadsheets.chart.insert"),
      insertTooltip: t("spreadsheets.chart.insertTooltip"),
      menu: t("spreadsheets.chart.menu"),
      kinds: {
        column: t("spreadsheets.chart.kind.column"),
        bar: t("spreadsheets.chart.kind.bar"),
        line: t("spreadsheets.chart.kind.line"),
        area: t("spreadsheets.chart.kind.area"),
        pie: t("spreadsheets.chart.kind.pie"),
      },
      useSelection: t("spreadsheets.chart.useSelection"),
      remove: t("spreadsheets.chart.remove"),
      label: (range) => t("spreadsheets.chart.label", { range }),
      seriesName: (position) =>
        t("spreadsheets.chart.series", { n: String(position) }),
    }),
    [t],
  );
}
