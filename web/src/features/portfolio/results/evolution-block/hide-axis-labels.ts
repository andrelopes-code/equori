// Workaround for Slotted issue #187: the chart cannot hide the labels of an axis, so the engine's
// option turns off the labels of the category axis; the strip keeps its grid and so its start.
export function withoutAxisLabels(
  option: Record<string, unknown>,
): Record<string, unknown> {
  const axis = option.xAxis;
  if (typeof axis !== "object" || axis === null) return option;

  return {
    ...option,
    xAxis: Array.isArray(axis) ? axis.map(hide) : hide(axis),
  };
}

function hide(axis: unknown): unknown {
  const base = typeof axis === "object" && axis !== null ? axis : {};
  const labels: unknown = Reflect.get(base, "axisLabel");
  const kept = typeof labels === "object" && labels !== null ? labels : {};

  return { ...base, axisLabel: { ...kept, show: false } };
}
