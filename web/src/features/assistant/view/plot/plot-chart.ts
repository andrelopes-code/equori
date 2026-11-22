import type {
  ChartAnnotation,
  ChartSeries,
  ChartYAxis,
} from "@slotted/core/chart";

import type { PlotSeries } from "@/features/assistant/view/plot/plot-records";
import { withNumber } from "@/features/assistant/view/plot/plot-records";
import type {
  ViewPlotMark,
  ViewValue,
} from "@/features/assistant/view/view-types";

// A pie drawn as a donut, so the slices read as shares of a whole.
const DONUT = 0.6;

export interface PlotChartInput {
  series: PlotSeries[];
  // The table head as written: the label column first, then each column.
  head: string[];
  marks: ViewPlotMark[];
  // One value as text, through the view's formatter (privacy masks amounts).
  write: (v: ViewValue) => string;
  // One value on an axis: an amount in whole units of its currency.
  tick: (v: ViewValue) => string;
  // The label of the average line, from the written value.
  average: (value: string) => string;
}

export interface PlotChart {
  series: ChartSeries[];
  y: ChartYAxis | [ChartYAxis, ChartYAxis];
  annotations: ChartAnnotation[];
  // The averages as the key under the plot writes them: a label inside the plot covers the bars.
  averages: string[];
  legend: boolean;
  trigger: "axis" | "item";
}

// The props of the Slotted chart for a view's plot (answer views design, V36): each series with
// its kind, axis, stack, curve and tone; a second value axis when a series reads the end axis;
// the averages as lines, written in the key under the plot.
export function plotChart(input: PlotChartInput): PlotChart {
  const { series, marks, tick } = input;
  const pie = series[0]?.drawn.kind === "pie";
  const end = series.find((s) => axisOf(s) === "end");
  const start = series.find((s) => axisOf(s) === "start") ?? series[0];
  const startAxis: ChartYAxis =
    start === undefined ? {} : { format: formatOf(start.unit, tick) };
  const y: PlotChart["y"] =
    end === undefined
      ? startAxis
      : [startAxis, { format: formatOf(end.unit, tick) }];

  return {
    series: series.map((s) => chartSeries(s, input, pie)),
    y,
    annotations: marks.flatMap((m) => averageLine(m, input)),
    averages: marks.map((m) => input.average(tick(m.value))),
    legend: pie || series.length > 1,
    trigger: pie ? "item" : "axis",
  };
}

function chartSeries(
  s: PlotSeries,
  input: PlotChartInput,
  pie: boolean,
): ChartSeries {
  const axis = axisOf(s);

  return {
    id: s.field,
    kind: s.drawn.kind,
    field: s.field,
    label: input.head[s.column] ?? "",
    format: formatOf(s.unit, input.write),
    axis,
    stack: s.drawn.stack === true ? axis : undefined,
    curve: s.drawn.curve,
    tone: s.drawn.tone,
    innerRadius: pie ? DONUT : undefined,
  };
}

function averageLine(
  m: ViewPlotMark,
  input: PlotChartInput,
): ChartAnnotation[] {
  const s = input.series.find((x) => x.column === m.column);
  if (s === undefined) return [];

  return [
    {
      kind: "line",
      axis: axisOf(s),
      value: m.value.money?.amount ?? m.value.count ?? 0,
      tone: "neutral",
    },
  ];
}

function axisOf(s: PlotSeries): "start" | "end" {
  return s.drawn.axis === "end" ? "end" : "start";
}

function formatOf(unit: ViewValue, write: (v: ViewValue) => string) {
  return (n: number) => write(withNumber(unit, n));
}
