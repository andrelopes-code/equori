import type { ChartAnnotation, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";

import { plotCeiling } from "@/features/portfolio/projection/contributions-block/contributions-rows";
import type {
  ContributionField,
  ContributionRow,
} from "@/features/portfolio/projection/contributions-block/contributions-rows";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The pixels the value labels take in the compact form ("R$ 2,5 mi").
const labelWidth = 72;

interface ContributionsPlotProps {
  rows: ContributionRow[];
  today: string | undefined;
  currency: string;
  scale: number;
}

// PX8: the recorded monthly contributions as bars and the intention as steps; no label is drawn
// at the end of a line.
export function ContributionsPlot({
  rows,
  today,
  currency,
  scale,
}: ContributionsPlotProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const money = useJourneyMoney(currency, scale);

  const exact = (value: number) => money.exact(value * 10 ** scale);
  const short = (value: number) => money.compact(value * 10 ** scale);
  const series: ChartSeries<ContributionField>[] = [
    {
      id: "recorded",
      kind: "bar",
      field: "recorded",
      label: t("portfolio.projection.contributions.key.recorded"),
      slot: 1,
      format: exact,
    },
    {
      id: "planned",
      kind: "line",
      field: "planned",
      label: t("portfolio.projection.contributions.key.planned"),
      slot: 1,
      curve: "step",
      format: exact,
    },
  ];
  const annotations: ChartAnnotation[] =
    today === undefined
      ? []
      : [
          {
            kind: "line",
            axis: "x",
            value: today,
            label: t("portfolio.projection.contributions.today"),
          },
        ];

  return (
    <Chart
      variant="plain"
      size="md"
      legend={false}
      toolbar="hover"
      aria-label={t("portfolio.projection.contributions.plot")}
      locale={tag}
      data={rows}
      series={series}
      annotations={annotations}
      x={{
        field: "date",
        type: "time",
        format: { month: "short", year: "numeric" },
      }}
      y={{ format: short, labelWidth, min: 0, max: plotCeiling(rows) }}
    />
  );
}
