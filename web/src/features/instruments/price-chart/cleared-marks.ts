// Workaround for Slotted issue #108: the chart leaves the band of a cleared range and the lines of
// removed annotations out of its option, and the engine merges options, so they stay painted. An
// empty list on every series that has none replaces them.
export function withClearedMarks<T>(option: T): T {
  const series = (option as { series?: unknown }).series;
  if (!Array.isArray(series)) return option;

  return {
    ...option,
    series: series.map((s: unknown) =>
      typeof s === "object" && s !== null
        ? { markArea: { data: [] }, markLine: { data: [] }, ...s }
        : s,
    ),
  };
}
