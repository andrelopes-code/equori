import { lazyRouteComponent } from "@tanstack/react-router";

export { preloadEditor as preloadSpreadsheetEditor } from "@/features/spreadsheets/editor/load-editor";

export const SpreadsheetsPage = lazyRouteComponent(
  () => import("@/features/spreadsheets/pages/spreadsheets-page"),
  "SpreadsheetsPage",
);

export const SpreadsheetPage = lazyRouteComponent(
  () => import("@/features/spreadsheets/pages/spreadsheet-page"),
  "SpreadsheetPage",
);
