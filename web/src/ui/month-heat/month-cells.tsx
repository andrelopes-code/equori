import { heatLevel, type HeatSteps } from "@/ui/month-heat/heat-level";
import { emptyCell } from "@/ui/month-heat/month-cell-text";
import styles from "@/ui/month-heat/month-heat.module.css";

interface MonthCellsProps {
  // The twelve changes of a year, in fractions; null without one.
  cells: readonly (number | null)[];
  text: (cell: number) => string;
  steps?: HeatSteps;
}

// PR8: the twelve cells of a year, shaded by the size of the change.
export function MonthCells({ cells, text, steps }: MonthCellsProps) {
  return cells.map((cell, month) => (
    <td key={month} className={heatClass(cell, steps)}>
      {cell === null ? emptyCell : text(cell)}
    </td>
  ));
}

function heatClass(cell: number | null, steps?: HeatSteps): string | undefined {
  const heat = heatLevel(cell, steps);

  return heat === null
    ? undefined
    : styles[`${heat.tone}${String(heat.level)}`];
}
