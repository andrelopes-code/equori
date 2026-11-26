import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import type {
  EvolutionField,
  EvolutionRow,
} from "@/features/portfolio/results/evolution-block/evolution-rows";
import styles from "@/features/portfolio/results/evolution-block/evolution-block.module.css";
import type { EvolutionAxes } from "@/features/portfolio/results/evolution-block/use-evolution-axes";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface FlowStripProps {
  rows: EvolutionRow[];
  axes: EvolutionAxes;
}

// PR9: the flow of each month on its own strip under the plot, an inflow in the portfolio's colour
// and an outflow in the danger tone; the axes are those of the plot above.
export function FlowStrip({ rows, axes }: FlowStripProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const label = t("portfolio.results.evolution.flows");
  const series: ChartSeries<EvolutionField>[] = [
    {
      id: "flowIn",
      kind: "bar",
      field: "flowIn",
      label: t("portfolio.results.evolution.flows.in"),
      slot: 1,
      stack: "flows",
      format: axes.exact,
    },
    {
      id: "flowOut",
      kind: "bar",
      field: "flowOut",
      label: t("portfolio.results.evolution.flows.out"),
      tone: "danger",
      stack: "flows",
      format: axes.exact,
    },
  ];

  return (
    <>
      <div className={styles.flowHead}>
        <span className={styles.flowTitle}>{label}</span>

        <ul className={styles.keyList}>
          <li>
            <span className={styles.flowIn} aria-hidden="true" />
            {t("portfolio.results.evolution.flows.in")}
          </li>

          <li>
            <span className={styles.flowOut} aria-hidden="true" />
            {t("portfolio.results.evolution.flows.out")}
          </li>
        </ul>
      </div>

      <Chart
        variant="plain"
        size="sm"
        legend={false}
        toolbar="hover"
        aria-label={label}
        locale={tag}
        data={rows}
        series={series}
        // The plot above writes the months; the strip gives their room to its bars.
        x={{ ...axes.x, labels: false }}
        y={axes.y}
      />
    </>
  );
}
