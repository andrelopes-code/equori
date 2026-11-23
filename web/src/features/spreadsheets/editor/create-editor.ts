import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import { UniverSheetsDrawingPreset } from "@univerjs/preset-sheets-drawing";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import { UniverSheetsFindReplacePreset } from "@univerjs/preset-sheets-find-replace";
import { UniverSheetsHyperLinkPreset } from "@univerjs/preset-sheets-hyper-link";
import { UniverSheetsNotePreset } from "@univerjs/preset-sheets-note";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import { UniverSheetsTablePreset } from "@univerjs/preset-sheets-table";
import { CommandType, createUniver, LogLevel } from "@univerjs/presets";
import type { INumfmtLocaleTag } from "@univerjs/presets";

import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-drawing/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";
import "@univerjs/preset-sheets-hyper-link/lib/index.css";
import "@univerjs/preset-sheets-note/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-table/lib/index.css";
import "@/features/spreadsheets/editor/univer-chrome.css";

import type { SpreadsheetContent } from "@/features/spreadsheets/api";
import type { ChartTexts } from "@/features/spreadsheets/charts/chart-texts";
import { registerCharts } from "@/features/spreadsheets/charts/register-charts";
import { adoptRefusedStyles } from "@/features/spreadsheets/editor/adopt-styles";
import { changesWorkbook } from "@/features/spreadsheets/editor/changes-workbook";
import { numfmtLocale } from "@/features/spreadsheets/editor/numfmt-locale";
import { sheetRows } from "@/features/spreadsheets/files/sheet-rows";
import { loadUniverLocale } from "@/features/spreadsheets/editor/univer-locale";
import { univerTheme } from "@/features/spreadsheets/editor/univer-theme";

// What the page does with a mounted editor.
export interface Editor {
  // The content on screen, as the server stores it.
  snapshot: () => SpreadsheetContent;
  // The name of the sheet on screen and the values of its cells, row by row.
  activeSheet: () => { name: string; rows: unknown[][] };
  setDark: (dark: boolean) => void;
  dispose: () => void;
}

interface EditorOptions {
  container: HTMLElement;
  content: SpreadsheetContent;
  editable: boolean;
  dark: boolean;
  // The language of the application, "pt" or "en".
  language: string;
  // The tag of the application's locale, by which numbers and dates are read and written.
  localeTag: string;
  chartTexts: ChartTexts;
  // A command changed the content.
  onChange: () => void;
}

export async function createEditor(options: EditorOptions): Promise<Editor> {
  const { locale, pack } = await loadUniverLocale(options.language);
  const releaseStyles = adoptRefusedStyles();
  const { univer, univerAPI } = createUniver({
    locale,
    locales: { [locale]: pack },
    theme: univerTheme(options.container),
    darkMode: options.dark,
    logLevel: LogLevel.ERROR,
    presets: [
      UniverSheetsCorePreset({
        container: options.container,
        // One toolbar with every tool, as a web spreadsheet draws it: the ribbon with tabs
        // moves its icons after each change of tab.
        ribbonType: "simple",
      }),
      UniverSheetsConditionalFormattingPreset(),
      UniverSheetsDataValidationPreset(),
      UniverSheetsDrawingPreset(),
      UniverSheetsFilterPreset(),
      UniverSheetsFindReplacePreset(),
      UniverSheetsHyperLinkPreset(),
      UniverSheetsNotePreset(),
      UniverSheetsSortPreset(),
      UniverSheetsTablePreset(),
    ],
  });

  registerCharts({
    api: univerAPI,
    texts: options.chartTexts,
    editable: options.editable,
    localeTag: options.localeTag,
  });

  const workbook = univerAPI.createWorkbook(options.content);
  workbook.setNumfmtLocal(numfmtLocale(options.localeTag) as INumfmtLocaleTag);
  if (!options.editable) workbook.setEditable(false);

  const workbookID = workbook.getId();
  const subscription = univerAPI.addEvent(
    univerAPI.Event.CommandExecuted,
    ({ type, id, params, options: commandOptions }) => {
      if (
        type === CommandType.MUTATION &&
        commandOptions?.onlyLocal !== true &&
        changesWorkbook(id, params, workbookID)
      )
        options.onChange();
    },
  );

  return {
    snapshot: () => workbook.save() as unknown as SpreadsheetContent,
    activeSheet: () => {
      const sheet = workbook.getActiveSheet();
      const range = sheet.getDataRange();

      return {
        name: sheet.getSheetName(),
        rows: sheetRows(
          range.getRawValues(),
          range.getDisplayValues(),
          range.getNumberFormats(),
        ),
      };
    },
    setDark: (dark) => {
      univerAPI.toggleDarkMode(dark);
    },
    dispose: () => {
      subscription.dispose();
      univer.dispose();
      releaseStyles();
    },
  };
}
