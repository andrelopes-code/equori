// Workaround for Slotted issue #155: a chart starts its plot where its value labels end, so two
// charts stacked on the same months start their plots at different places and a month sits at
// two x positions. Both charts take one start wide enough for a label such as "−10,00%"; the
// engine still widens it when a label is wider.
const plotStart = 64;

export function alignedPlot(
  option: Record<string, unknown>,
): Record<string, unknown> {
  const grid = option.grid;
  if (grid === null || typeof grid !== "object" || Array.isArray(grid)) {
    return option;
  }

  // The outer bounds become the chart's own edges, so the labels still fit inside the chart while
  // the plot starts at plotStart rather than where the widest label ends.
  option.grid = {
    ...grid,
    left: plotStart,
    outerBoundsMode: "auto",
    outerBounds: { left: 0, right: 0, top: 0, bottom: 0 },
  };

  return option;
}
