import type { FUniver } from "@univerjs/presets";
import { createElement } from "react";

import { BoundChart } from "@/features/spreadsheets/charts/bound-chart";
import type { BoundChartOptions } from "@/features/spreadsheets/charts/bound-chart";
import { chartRange } from "@/features/spreadsheets/charts/chart-cells";

const componentKey = "equori-sheet-chart";

// The size of a new chart on the sheet, in pixels, and its distance from the cells it reads.
const width = 520;
const height = 360;
const gap = 24;

// The columns and rows measured to place a new chart; past them the chart keeps the place of
// the last one measured.
const measured = 200;

// Adds charts to an editor: the element that draws one, registered before the workbook opens
// so a stored chart finds it, and the entry of the Insert tab that places a new one beside the
// selected cells. A member who only reads gets the charts without the entry.
export function registerCharts(options: BoundChartOptions): void {
  const { api, texts, editable } = options;

  api.registerComponent(componentKey, (props: object) =>
    createElement(BoundChart, { ...props, ...options }),
  );

  if (!editable) return;

  api
    .createMenu({
      id: "equori.spreadsheets.insert-chart",
      title: texts.insert,
      tooltip: texts.insertTooltip,
      action: () => {
        insertChart(api);
        closeToolbarOverflow();
      },
    })
    .appendTo("ribbon.insert.media");
}

function insertChart(api: FUniver): void {
  const sheet = api.getActiveWorkbook()?.getActiveSheet();
  const range = chartRange(api);
  if (sheet === undefined || range === null) return;

  // A place on a sheet counts from the corner of the headers, not from the first cell.
  const headers = sheet.getSheet().getConfig();

  let left = headers.rowHeader.width + gap;
  for (let c = 0; c <= Math.min(range.endColumn, measured); c++)
    left += sheet.getColumnWidth(c);

  let top = headers.columnHeader.height;
  for (let r = 0; r < Math.min(range.startRow, measured); r++)
    top += sheet.getRowHeight(r);

  sheet.addFloatDomToPosition({
    componentKey,
    allowTransform: true,
    initPosition: {
      startX: left,
      endX: left + width,
      startY: top,
      endY: top + height,
    },
    data: {
      kind: "column",
      sheetID: sheet.getSheetId(),
      range: {
        startRow: range.startRow,
        endRow: range.endRow,
        startColumn: range.startColumn,
        endColumn: range.endColumn,
      },
    },
  });
}

// The entry stands in the overflow of the toolbar, a popover that stays open after a press and
// would cover the new chart. The popover closes on Escape from the element that holds focus.
function closeToolbarOverflow(): void {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
}
