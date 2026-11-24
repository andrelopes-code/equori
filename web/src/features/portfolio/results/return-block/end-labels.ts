// The room the labels at the end of the lines take at the right of the plot, in pixels.
const endLabelSpace = 120;

// Workaround for Slotted issue #185: the chart cannot label a line at its last point, so the
// engine's option takes one end label per series, named by the series id, and the series' own label
// is turned off so a line is never labelled twice.
export function withEndLabels(
  option: Record<string, unknown>,
  labels: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const series = option.series;
  if (!Array.isArray(series)) return option;

  return {
    ...option,
    grid: roomAtEnd(option.grid),
    series: series.map((entry: unknown) => {
      if (typeof entry !== "object" || entry === null) return entry;

      const key: unknown =
        Reflect.get(entry, "id") ?? Reflect.get(entry, "name");
      const label = typeof key === "string" ? labels[key] : undefined;
      if (label === undefined) return entry;

      return {
        ...entry,
        ...(Reflect.has(entry, "label") ? { label: { show: false } } : {}),
        endLabel: { show: true, formatter: label, distance: 8 },
        labelLayout: { moveOverlap: "shiftY" },
      };
    }),
  };
}

function roomAtEnd(grid: unknown): unknown {
  if (Array.isArray(grid)) return grid.map(roomAtEnd);

  const base = typeof grid === "object" && grid !== null ? grid : {};

  return { ...base, right: endLabelSpace };
}
