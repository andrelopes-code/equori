import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import styles from "@/features/portfolio/results/evolution-block/evolution-block.module.css";
import type {
  EvolutionField,
  EvolutionRow,
} from "@/features/portfolio/results/evolution-block/evolution-rows";
import type { EvolutionAxes } from "@/features/portfolio/results/evolution-block/use-evolution-axes";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface EvolutionPlotProps {
  rows: EvolutionRow[];
  axes: EvolutionAxes;
}

// PR9, PR12: the value as the portfolio line, the money contributed as a dashed step line and the
// area between them as a range.
export function EvolutionPlot({ rows, axes }: EvolutionPlotProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const series: ChartSeries<EvolutionField>[] = [
    {
      id: "gain",
      kind: "range",
      lower: "contributed",
      upper: "value",
      of: "value",
      label: t("portfolio.results.evolution.gain"),
    },
    {
      id: "value",
      kind: "line",
      field: "value",
      label: t("portfolio.results.evolution.value"),
      slot: 1,
      markers: "last",
      format: axes.exact,
    },
    {
      id: "contributed",
      kind: "line",
      field: "contributed",
      label: t("portfolio.results.evolution.contributed"),
      tone: "neutral",
      stroke: "dashed",
      curve: "step",
      format: axes.exact,
    },
  ];

  return (
    <div className={styles.plotArea}>
      <Chart
        variant="plain"
        size="md"
        legend={false}
        toolbar="hover"
        aria-label={t("portfolio.results.plot.evolution")}
        locale={tag}
        data={rows}
        series={series}
        x={axes.x}
        y={axes.y}
      />
    </div>
  );
}
