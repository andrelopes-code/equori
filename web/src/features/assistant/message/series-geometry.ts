import type { SeriesRow } from "@/features/assistant/message/answer-blocks";

export interface SeriesPoint {
  x: number;
  y: number;
}

export interface SeriesMark extends SeriesPoint {
  index: number;
  // The row's own cell text: the value for the lowest point, the day for an axis label.
  text: string;
}

export interface SeriesLabel extends SeriesMark {
  anchor: "start" | "middle" | "end";
}

export interface SeriesGeometry {
  line: string;
  area: string;
  zeroY: number | undefined;
  low: SeriesMark;
  last: SeriesPoint;
  labels: SeriesLabel[];
}

export const seriesBox = {
  width: 380,
  height: 130,
  left: 4,
  right: 376,
  top: 16,
  bottom: 104,
};

// The step-after line of a balance: it holds its value until the next row. The y range runs from
// min(0, lowest) to the highest value; the zero line exists when the range reaches zero. Rows
// are never empty for a series segment; an empty list has no geometry.
export function seriesGeometry(rows: SeriesRow[]): SeriesGeometry | undefined {
  const { left, right, top, bottom } = seriesBox;
  const lastRow = rows.at(-1);
  if (lastRow === undefined) return undefined;

  const values = rows.map((row) => row.value);
  const highest = Math.max(...values);
  const floor = Math.min(0, ...values);
  const span = Math.max(1, lastRow.day);
  const height = highest > floor ? highest - floor : 1;
  const x = (day: number) => round(left + (day / span) * (right - left));
  const y = (value: number) =>
    round(bottom - ((value - floor) / height) * (bottom - top));
  const marks = rows.map((row, index) => ({
    index,
    x: x(row.day),
    y: y(row.value),
    value: row.value,
    text: row.text,
    label: row.label,
  }));
  const line = marks
    .map((m, i) =>
      i === 0
        ? `M${String(m.x)},${String(m.y)}`
        : `H${String(m.x)} V${String(m.y)}`,
    )
    .join(" ");
  const low = marks.reduce((a, b) => (b.value < a.value ? b : a));
  const shown = new Set([0, low.index, marks.length - 1]);

  return {
    line,
    area: `${line} V${String(bottom)} H${String(left)} Z`,
    zeroY: highest >= 0 ? y(0) : undefined,
    low: { index: low.index, x: low.x, y: low.y, text: low.text },
    last: { x: x(lastRow.day), y: y(lastRow.value) },
    labels: marks
      .filter((m) => shown.has(m.index))
      .map((m) => ({
        index: m.index,
        x: m.x,
        y: m.y,
        text: m.label,
        anchor: anchorOf(m.index, marks.length),
      })),
  };
}

function anchorOf(index: number, count: number): SeriesLabel["anchor"] {
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "middle";
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
