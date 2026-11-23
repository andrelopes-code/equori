import { CommandType } from "@univerjs/presets";
import type { FUniver } from "@univerjs/presets";
import { useEffect, useRef, useState } from "react";

import { ChartMenu } from "@/features/spreadsheets/charts/chart-menu";
import {
  chartTable,
  readSettings,
} from "@/features/spreadsheets/charts/chart-table";
import type {
  ChartKind,
  ChartSettings,
} from "@/features/spreadsheets/charts/chart-table";
import type { ChartTexts } from "@/features/spreadsheets/charts/chart-texts";
import {
  chartRange,
  rangeName,
  readRows,
} from "@/features/spreadsheets/charts/chart-cells";
import { SheetChart } from "@/features/spreadsheets/charts/sheet-chart";

export interface BoundChartOptions {
  api: FUniver;
  texts: ChartTexts;
  editable: boolean;
  localeTag: string;
}

interface BoundChartProps extends BoundChartOptions {
  // What the editor hands a floating element: its stored data and its id.
  data?: unknown;
  floatDomId?: string;
}

// The pause after a change of the cells before the chart reads them again.
const readDelay = 150;

// A chart on a sheet, bound to the workbook: it reads its cells again after each change, and
// its menu writes its settings back to the document.
export function BoundChart({
  api,
  texts,
  editable,
  localeTag,
  data,
  floatDomId,
}: BoundChartProps) {
  const settings = readSettings(data);
  const frame = useRef<HTMLDivElement>(null);
  const [, setReading] = useState(0);
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = api.addEvent(api.Event.CommandExecuted, ({ type }) => {
      if (type !== CommandType.MUTATION) return;

      clearTimeout(timer);
      timer = setTimeout(() => {
        setReading((n) => n + 1);
      }, readDelay);
    });

    return () => {
      clearTimeout(timer);
      subscription.dispose();
    };
  }, [api]);

  useEffect(() => {
    const element = frame.current;
    if (element === null) return;

    // The plot of the chart has three heights; the box takes the tallest that fits.
    const observer = new ResizeObserver(([entry]) => {
      const height = entry?.contentRect.height ?? 0;
      setSize(height < 320 ? "sm" : height < 460 ? "md" : "lg");
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (settings === null) return null;

  const sheet = api.getActiveWorkbook()?.getSheetBySheetId(settings.sheetID);

  function update(next: ChartSettings) {
    if (floatDomId === undefined) return;

    const { startRow, endRow, startColumn, endColumn } = next.range;

    sheet?.updateFloatDom(floatDomId, {
      data: {
        kind: next.kind,
        sheetID: next.sheetID,
        range: { startRow, endRow, startColumn, endColumn },
      },
    });
  }

  function handleKind(kind: ChartKind) {
    if (settings !== null) update({ ...settings, kind });
  }

  function handleUseSelection() {
    const range = chartRange(api);
    if (settings !== null && range !== null) update({ ...settings, range });
  }

  function handleRemove() {
    if (floatDomId !== undefined) sheet?.removeFloatDom(floatDomId);
  }

  return (
    <div ref={frame} style={{ inlineSize: "100%", blockSize: "100%" }}>
      <SheetChart
        kind={settings.kind}
        table={chartTable(readRows(api, settings), texts.seriesName)}
        label={texts.label(rangeName(settings.range))}
        locale={localeTag}
        size={size}
        actions={
          editable ? (
            <ChartMenu
              kind={settings.kind}
              texts={texts}
              onKind={handleKind}
              onUseSelection={handleUseSelection}
              onRemove={handleRemove}
            />
          ) : undefined
        }
      />
    </div>
  );
}
