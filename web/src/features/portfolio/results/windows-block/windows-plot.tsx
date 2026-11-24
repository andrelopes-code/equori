import type { ChartAnnotation, ChartSeries } from "@slotted/core/chart";
import { Chart } from "@slotted/react/chart";
import { useMemo } from "react";

import { withEndLabels } from "@/features/portfolio/results/return-block/end-labels";
import { toBasisPoints } from "@/features/portfolio/results/return-block/block-figures";
import {
  lastText,
  portfolioField,
} from "@/features/portfolio/results/return-block/plot-rows";
import {
  windowRows,
  type WindowFigures,
} from "@/features/portfolio/results/windows-block/windows-figures";
import { formatSignedBasisPoints, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface WindowsPlotProps {
  figures: WindowFigures;
}

const belowZero = "below-zero";

// The zero line of the value axis.
const zeroLine: ChartAnnotation[] = [{ kind: "line", axis: "start", value: 0 }];

// PR7, PR12: the return of each window, the portfolio solid and each index at its stroke, the zero
// line and, in the danger tone, the area between the portfolio line and zero where it is below.
export function WindowsPlot({ figures }: WindowsPlotProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const percent = numberFormatter(tag, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const exact = (value: number) =>
    formatSignedBasisPoints(toBasisPoints(value), tag);
  const data = useMemo(() => windowRows(figures), [figures]);
  const series: ChartSeries[] = [
    {
      id: belowZero,
      kind: "range",
      lower: "lower",
      upper: "upper",
      label: t("portfolio.results.windows.negative"),
      tone: "danger",
    },
    {
      id: portfolioField,
      kind: "line",
      field: portfolioField,
      label: t("portfolio.results.series.portfolio"),
      slot: 1,
      markers: "last",
      format: exact,
    },
    ...figures.indexes.map((index): ChartSeries => ({
      id: index.id,
      kind: "line",
      field: index.id,
      label: index.name,
      slot: index.slot as ChartSeries["slot"],
      stroke: index.dashed ? "dashed" : "solid",
      markers: "last",
      connectNulls: true,
      format: exact,
    })),
  ];
  const labels = Object.fromEntries(
    series
      .filter((line) => line.kind === "line")
      .map((line) => [
        line.id ?? "",
        `${line.label ?? ""} ${lastText(data, line.id ?? "", percent.format)}`,
      ]),
  );

  return (
    <Chart
      variant="plain"
      size="md"
      legend={false}
      toolbar="hover"
      aria-label={t("portfolio.results.plot.windows")}
      locale={tag}
      data={data}
      series={series}
      annotations={zeroLine}
      x={{
        field: "date",
        type: "time",
        format: { month: "short", year: "2-digit" },
      }}
      y={{ format: (value: number) => percent.format(value) }}
      extendOption={(option) => withEndLabels(option, labels)}
    />
  );
}
