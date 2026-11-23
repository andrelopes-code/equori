import type { SpreadsheetSummary } from "@/features/spreadsheets/api";

// What the reader asked to do with one spreadsheet, while its dialog is open.
export interface DocumentCommand {
  kind: "rename" | "copy" | "delete";
  document: Pick<SpreadsheetSummary, "id" | "name">;
}
