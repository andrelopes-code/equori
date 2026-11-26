import type { ChartAnnotation, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { periodDays } from "@/features/portfolio/return/portfolio-period";
import type { BlockFigures } from "@/features/portfolio/results/return-block/block-figures";
import { toBasisPoints } from "@/features/portfolio/results/return-block/block-figures";
import {
  plotRows,
  portfolioField,
  timeFormat,
} from "@/features/portfolio/results/return-block/plot-rows";
import { formatSignedBasisPoints, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type ReturnSeries = components["schemas"]["ReturnSeries"];

interface ReturnPlotProps {
  series: ReturnSeries;
  figures: BlockFigures;
  on: readonly string[];
}

// PR4, PR12: the cumulative return of the portfolio and of the indexes switched on; the largest
// fall is a band on the time axis; the list beside the plot names each line and its value.
export function ReturnPlot({ series, figures, on }: ReturnPlotProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const percent = numberFormatter(tag, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const exact = (value: number) =>
    formatSignedBasisPoints(toBasisPoints(value), tag);
  const data = useMemo(() => plotRows(series.points, series.indexes), [series]);
  const lines: ChartSeries[] = [
    {
      id: portfolioField,
      kind: "line",
      field: portfolioField,
      label: t("portfolio.results.series.portfolio"),
      slot: 1,
      // An index of another step adds dates the portfolio holds no point on.
      connectNulls: true,
      format: exact,
    },
    ...figures.indexes.map((index): ChartSeries => ({
      id: index.id,
      kind: "line",
      field: index.id,
      label: index.name,
      slot: index.slot as ChartSeries["slot"],
      stroke: index.stroke,
      connectNulls: true,
      format: exact,
    })),
  ];
  const hidden = figures.indexes
    .map((i) => i.id)
    .filter((id) => !on.includes(id));
  const annotations: ChartAnnotation[] =
    figures.fall === null
      ? []
      : [
          {
            kind: "band",
            axis: "x",
            from: figures.fall.from,
            to: figures.fall.to,
            tone: "danger",
          },
        ];

  return (
    <Chart
      variant="plain"
      size="lg"
      legend={false}
      toolbar="hover"
      aria-label={t("portfolio.results.plot.return")}
      locale={tag}
      data={data}
      series={lines}
      hidden={hidden}
      annotations={annotations}
      x={{
        field: "date",
        type: "time",
        format: timeFormat(periodDays(series.from, series.to)),
      }}
      y={{ format: (value: number) => percent.format(value) }}
    />
  );
}
