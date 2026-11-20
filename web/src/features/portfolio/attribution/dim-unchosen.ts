// fadedOpacity is the opacity of a bar of a year that is not chosen.
const fadedOpacity = 0.4;

interface BarItem {
  value: unknown;
  itemStyle?: Record<string, unknown>;
}

// Workaround for Slotted issue #158: the chart fades the bars of the other categories only when
// the slot colour is rgb(), and the theme's slots are oklch(); the option fades them itself.
export function dimUnchosen<T>(option: T, chosen: number): T {
  const series = (option as { series?: unknown }).series;
  if (!Array.isArray(series)) return option;

  return {
    ...option,
    series: series.map((s: unknown) => dimSeries(s, chosen)),
  };
}

function dimSeries(series: unknown, chosen: number): unknown {
  const s = series as { type?: unknown; data?: unknown };
  if (s.type !== "bar" || !Array.isArray(s.data)) return series;

  return {
    ...s,
    data: s.data.map((item: unknown, i) => (i === chosen ? item : faded(item))),
  };
}

function faded(item: unknown): BarItem {
  const bar: BarItem =
    typeof item === "object" && item !== null && "value" in item
      ? item
      : { value: item };

  return { ...bar, itemStyle: { ...bar.itemStyle, opacity: fadedOpacity } };
}
