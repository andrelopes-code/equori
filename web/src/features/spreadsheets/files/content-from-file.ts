import type { SpreadsheetContent } from "@/features/spreadsheets/api";
import {
  detectDelimiter,
  fieldValue,
  parseCsv,
} from "@/features/spreadsheets/files/csv";
import type {
  CellData,
  WorkbookData,
} from "@/features/spreadsheets/files/snapshot";

// The file is neither an XLSX workbook nor a CSV text.
export class UnsupportedFileError extends Error {
  constructor() {
    super("unsupported file");
    this.name = "UnsupportedFileError";
  }
}

export interface ImportedFile {
  // The name of the file without its extension, as the name of the new spreadsheet.
  name: string;
  content: SpreadsheetContent;
}

// The content of a new spreadsheet from a file the reader chose: the sheets of an XLSX
// workbook, or one sheet with the rows of a CSV text. The XLSX reader is a chunk of its own.
export async function contentFromFile(
  file: File,
  sheetName: string,
): Promise<ImportedFile> {
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  const name = file.name.replace(/\.[a-z0-9]+$/i, "").trim() || file.name;

  if (extension === "xlsx") {
    const { readXlsx } =
      await import("@/features/spreadsheets/files/xlsx-read");
    const workbook = readXlsx(new Uint8Array(await file.arrayBuffer()));

    return { name, content: { ...workbook } };
  }

  if (extension === "csv" || extension === "tsv" || extension === "txt")
    return { name, content: { ...csvWorkbook(await file.text(), sheetName) } };

  throw new UnsupportedFileError();
}

// One sheet with a cell per field: a number where the field is one, a text otherwise.
export function csvWorkbook(text: string, sheetName: string): WorkbookData {
  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text);
  const cellData: Record<number, Record<number, CellData>> = {};
  let columns = 0;

  rows.forEach((fields, row) => {
    columns = Math.max(columns, fields.length);

    fields.forEach((field, column) => {
      if (field === "") return;

      const value = fieldValue(field, delimiter);
      (cellData[row] ??= {})[column] = {
        v: value,
        t: typeof value === "number" ? 2 : 1,
      };
    });
  });

  const id = "sheet-1";

  return {
    sheetOrder: [id],
    sheets: {
      [id]: {
        id,
        name: sheetName,
        cellData,
        rowCount: Math.max(1000, rows.length + 100),
        columnCount: Math.max(26, columns + 5),
      },
    },
  };
}
