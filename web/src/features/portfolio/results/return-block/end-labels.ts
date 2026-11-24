// The room the labels at the end of the lines take at the right of the plot, in pixels.
const endLabelSpace = 120;

// The family draws no label at the end of a line, so the engine's option takes one per series,
// named by the series id. This stays until the family exposes it.
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
