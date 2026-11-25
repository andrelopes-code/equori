import type { ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import styles from "@/features/portfolio/projection/versus-block/versus-block.module.css";
import type {
  VersusField,
  VersusRow,
} from "@/features/portfolio/projection/versus-block/versus-rows";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The pixels the value labels take in the compact form ("R$ 2,5 mi").
const labelWidth = 72;

interface VersusPlotProps {
  rows: VersusRow[];
  currency: string;
  scale: number;
}

// PX7: the recorded value (solid) and the plan line (dashed), with the area between them in the
// success tone where the value is above the line and in the danger tone where it is below.
export function VersusPlot({ rows, currency, scale }: VersusPlotProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const money = useJourneyMoney(currency, scale);

  const exact = (value: number) => money.exact(value * 10 ** scale);
  const short = (value: number) => money.compact(value * 10 ** scale);
  const series: ChartSeries<VersusField>[] = [
    {
      id: "ahead",
      kind: "range",
      lower: "aheadLower",
      upper: "aheadUpper",
      label: t("portfolio.projection.versus.key.ahead"),
      tone: "success",
    },
    {
      id: "behind",
      kind: "range",
      lower: "behindLower",
      upper: "behindUpper",
      label: t("portfolio.projection.versus.key.behind"),
      tone: "danger",
    },
    {
      id: "value",
      kind: "line",
      field: "value",
      label: t("portfolio.projection.versus.key.value"),
      slot: 1,
      markers: "last",
      format: exact,
    },
    {
      id: "plan",
      kind: "line",
      field: "plan",
      label: t("portfolio.projection.versus.key.plan"),
      slot: 1,
      // Workaround for Slotted issue #186: the chart has no dotted stroke, so the plan line of the
      // mock takes the dash.
      stroke: "dashed",
      markers: "last",
      format: exact,
    },
  ];

  return (
    <div className={styles.plotArea}>
      <Chart
        variant="plain"
        size="md"
        legend={false}
        toolbar="hover"
        aria-label={t("portfolio.projection.versus.plot")}
        locale={tag}
        data={rows}
        series={series}
        x={{
          field: "date",
          type: "time",
          format: { month: "short", year: "numeric" },
        }}
        y={{ format: short, labelWidth }}
      />
    </div>
  );
}
