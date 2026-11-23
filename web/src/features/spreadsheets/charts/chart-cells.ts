import type { FUniver } from "@univerjs/presets";

import type { ChartSettings } from "@/features/spreadsheets/charts/chart-table";
import type { CellRange } from "@/features/spreadsheets/files/snapshot";
import { cellName } from "@/features/spreadsheets/files/xlsx-refs";

// "A1:C5".
export function rangeName(range: CellRange): string {
  return `${cellName(range.startRow, range.startColumn)}:${cellName(range.endRow, range.endColumn)}`;
}

// The values of the cells a chart reads; nothing when its sheet is gone.
export function readRows(api: FUniver, settings: ChartSettings): unknown[][] {
  const sheet = api.getActiveWorkbook()?.getSheetBySheetId(settings.sheetID);
  if (sheet === null || sheet === undefined) return [];

  const { startRow, endRow, startColumn, endColumn } = settings.range;

  return sheet
    .getRange(
      startRow,
      startColumn,
      endRow - startRow + 1,
      endColumn - startColumn + 1,
    )
    .getRawValues();
}

// The cells a new chart reads: the selection, widened to the block of data around it when it
// is one cell, and cut at the last cell that holds something, so a whole column selected by its
// header gives its filled part.
export function chartRange(api: FUniver): CellRange | null {
  const workbook = api.getActiveWorkbook();
  if (workbook === null) return null;

  const selected = workbook.getActiveRange();
  if (selected === null) return null;

  const single = selected.getHeight() === 1 && selected.getWidth() === 1;
  const range = (single ? selected.getDataRegion() : selected).getRange();
  const filled = workbook.getActiveSheet().getDataRange().getRange();

  return {
    startRow: range.startRow,
    startColumn: range.startColumn,
    endRow: Math.max(range.startRow, Math.min(range.endRow, filled.endRow)),
    endColumn: Math.max(
      range.startColumn,
      Math.min(range.endColumn, filled.endColumn),
    ),
  };
}
