import type { ChartAnnotation, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import styles from "@/features/portfolio/projection/journey-block/journey-block.module.css";
import type { JourneyRow } from "@/features/portfolio/projection/journey-block/journey-rows";
import type { JourneyField } from "@/features/portfolio/projection/journey-block/journey-rows";
import type { JourneyAxes } from "@/features/portfolio/projection/journey-block/use-journey-axes";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface JourneyPlotProps {
  rows: JourneyRow[];
  axes: JourneyAxes;
  // The dates of the rows the marks stand on; a mark with no row is not drawn.
  todayDate: string | undefined;
  withdrawalDate: string;
  withdrawalAge: number;
}

// PX6: the recorded value (solid), the money contributed and the projection (dashed), the area
// between the value and the money contributed, and the marks at today and at the withdrawal age.
export function JourneyPlot({
  rows,
  axes,
  todayDate,
  withdrawalDate,
  withdrawalAge,
}: JourneyPlotProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const series: ChartSeries<JourneyField>[] = [
    {
      id: "gain",
      kind: "range",
      lower: "contributed",
      upper: "value",
      of: "value",
      label: t("portfolio.projection.journey.key.gain"),
    },
    {
      id: "value",
      kind: "line",
      field: "value",
      label: t("portfolio.projection.journey.key.value"),
      slot: 1,
      markers: "last",
      format: axes.exact,
    },
    {
      id: "projected",
      kind: "line",
      field: "projected",
      label: t("portfolio.projection.journey.key.plan"),
      slot: 1,
      stroke: "dashed",
      markers: "last",
      format: axes.exact,
    },
    {
      id: "contributed",
      kind: "line",
      field: "contributed",
      label: t("portfolio.projection.journey.key.contributed"),
      tone: "neutral",
      stroke: "dashed",
      curve: "step",
      format: axes.exact,
    },
  ];
  const lastDate = rows.at(-1)?.date;
  const annotations: ChartAnnotation[] = [
    {
      kind: "line",
      axis: "x",
      value: todayDate,
      label: t("portfolio.projection.journey.today"),
    },
    {
      kind: "line",
      axis: "x",
      value: withdrawalDate,
      label: t("portfolio.projection.journey.withdrawals", {
        age: withdrawalAge,
      }),
    },
    { kind: "band", axis: "x", from: withdrawalDate, to: lastDate },
  ];

  return (
    <div className={styles.plotArea}>
      <Chart
        variant="plain"
        size="md"
        legend={false}
        toolbar="hover"
        aria-label={t("portfolio.projection.journey.plot")}
        locale={tag}
        data={rows}
        series={series}
        annotations={annotations}
        x={axes.x}
        y={axes.y}
      />
    </div>
  );
}
