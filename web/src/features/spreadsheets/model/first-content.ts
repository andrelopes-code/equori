import type { SpreadsheetContent } from "@/features/spreadsheets/api";

// The content of a new spreadsheet: one empty sheet with the name of the reader's language.
// The editor fills every other default when it opens the content.
export function firstContent(sheetName: string): SpreadsheetContent {
  const id = "sheet-1";

  return {
    sheetOrder: [id],
    sheets: { [id]: { id, name: sheetName } },
  };
}
