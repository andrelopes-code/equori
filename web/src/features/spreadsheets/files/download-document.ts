import type { Editor } from "@/features/spreadsheets/editor/create-editor";
import { formatCsv } from "@/features/spreadsheets/files/csv";
import { downloadFile } from "@/features/spreadsheets/files/download-file";

const xlsxType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Hands the reader what the editor shows: every sheet as an XLSX workbook, or the sheet on
// screen as a CSV text. The XLSX writer is a chunk of its own.
export async function downloadDocument(
  editor: Editor,
  name: string,
  format: "xlsx" | "csv",
): Promise<void> {
  if (format === "xlsx") {
    const { writeXlsx } =
      await import("@/features/spreadsheets/files/xlsx-write");

    downloadFile(name, "xlsx", writeXlsx(editor.snapshot()), xlsxType);
    return;
  }

  const sheet = editor.activeSheet();

  // The byte order mark tells a desktop spreadsheet that the text is UTF-8.
  downloadFile(
    `${name} - ${sheet.name}`,
    "csv",
    `\uFEFF${formatCsv(sheet.rows)}`,
    "text/csv;charset=utf-8",
  );
}
