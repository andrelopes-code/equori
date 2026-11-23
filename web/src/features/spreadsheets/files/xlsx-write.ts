import { strToU8, zipSync } from "fflate";

import type {
  CellData,
  SheetData,
  StyleData,
  WorkbookData,
} from "@/features/spreadsheets/files/snapshot";
import { escapeXml } from "@/features/spreadsheets/files/xlsx-formats";
import {
  cellName,
  columnName,
  shiftFormula,
} from "@/features/spreadsheets/files/xlsx-refs";
import { StyleWriter } from "@/features/spreadsheets/files/xlsx-style-writer";

const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationships =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRelationships =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// Pixels of a column per unit of XLSX width (one digit of the default font), and points of a
// row per pixel.
const pixelsPerWidth = 7;
const pointsPerPixel = 0.75;

// The bytes of an XLSX file with the sheets of a workbook snapshot: values, formulas, number
// formats, fonts, fills, borders, alignment, merged cells, sizes of rows and columns and
// frozen panes. A reader computes the formulas again when it opens the file.
export function writeXlsx(workbook: WorkbookData): Uint8Array<ArrayBuffer> {
  const styles = new StyleWriter();
  const sheets = orderedSheets(workbook);
  const names = sheetNames(sheets);
  const files: Record<string, Uint8Array> = {};

  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${String(i + 1)}.xml`] = strToU8(
      sheetXml(sheet, workbook.styles ?? {}, styles),
    );
  });

  files["[Content_Types].xml"] = strToU8(contentTypesXml(sheets.length));
  files["_rels/.rels"] = strToU8(
    `${declaration}<Relationships xmlns="${packageRelationships}">` +
      `<Relationship Id="rId1" Type="${relationships}/officeDocument" Target="xl/workbook.xml"/>` +
      "</Relationships>",
  );
  files["xl/workbook.xml"] = strToU8(workbookXml(sheets, names));
  files["xl/_rels/workbook.xml.rels"] = strToU8(workbookRelsXml(sheets.length));
  files["xl/styles.xml"] = strToU8(styles.xml());

  // A copy over a buffer of its own: a Blob takes no view of a shared buffer.
  return new Uint8Array(zipSync(files));
}

function orderedSheets(workbook: WorkbookData): SheetData[] {
  const sheets = workbook.sheets ?? {};
  const order = workbook.sheetOrder ?? Object.keys(sheets);
  const found = order
    .map((id) => sheets[id])
    .filter((sheet): sheet is SheetData => sheet !== undefined);

  // A workbook without a sheet is not an XLSX file.
  return found.length > 0 ? found : [{ id: "sheet-1", name: "Sheet1" }];
}

// A sheet name of XLSX holds at most 31 characters, none of []:*?/\ and is unique in the file.
function sheetNames(sheets: readonly SheetData[]): string[] {
  const taken = new Set<string>();

  return sheets.map((sheet, i) => {
    const base =
      sheet.name
        .replace(/[[\]:*?/\\]/g, " ")
        .trim()
        .slice(0, 31) || `Sheet${String(i + 1)}`;
    let name = base;

    for (let n = 2; taken.has(name.toLowerCase()); n++) {
      const suffix = ` (${String(n)})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }

    taken.add(name.toLowerCase());

    return name;
  });
}

function contentTypesXml(sheets: number): string {
  const parts = Array.from(
    { length: sheets },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${String(i + 1)}.xml" ` +
      'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
  ).join("");

  return (
    `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ' +
    'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ' +
    'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    parts +
    "</Types>"
  );
}

function workbookXml(
  sheets: readonly SheetData[],
  names: readonly string[],
): string {
  const entries = sheets
    .map(
      (sheet, i) =>
        `<sheet name="${escapeXml(names[i] ?? "")}" sheetId="${String(i + 1)}"` +
        `${sheet.hidden === 1 ? ' state="hidden"' : ""} r:id="rId${String(i + 1)}"/>`,
    )
    .join("");

  return (
    `${declaration}<workbook xmlns="${main}" xmlns:r="${relationships}">` +
    `<sheets>${entries}</sheets><calcPr fullCalcOnLoad="1"/></workbook>`
  );
}

function workbookRelsXml(sheets: number): string {
  const entries = Array.from(
    { length: sheets },
    (_, i) =>
      `<Relationship Id="rId${String(i + 1)}" Type="${relationships}/worksheet" ` +
      `Target="worksheets/sheet${String(i + 1)}.xml"/>`,
  ).join("");

  return (
    `${declaration}<Relationships xmlns="${packageRelationships}">${entries}` +
    `<Relationship Id="rId${String(sheets + 1)}" Type="${relationships}/styles" Target="styles.xml"/>` +
    "</Relationships>"
  );
}

function sheetXml(
  sheet: SheetData,
  named: Readonly<Record<string, StyleData>>,
  styles: StyleWriter,
): string {
  const merges = (sheet.mergeData ?? [])
    .map(
      (m) =>
        `<mergeCell ref="${cellName(m.startRow, m.startColumn)}:${cellName(m.endRow, m.endColumn)}"/>`,
    )
    .join("");

  return (
    `${declaration}<worksheet xmlns="${main}">` +
    paneXml(sheet) +
    columnsXml(sheet) +
    `<sheetData>${rowsXml(sheet, named, styles)}</sheetData>` +
    (merges === ""
      ? ""
      : `<mergeCells count="${String(sheet.mergeData?.length ?? 0)}">${merges}</mergeCells>`) +
    "</worksheet>"
  );
}

function paneXml(sheet: SheetData): string {
  const columns = Math.max(0, sheet.freeze?.xSplit ?? 0);
  const rows = Math.max(0, sheet.freeze?.ySplit ?? 0);
  if (columns === 0 && rows === 0) return "";

  return (
    '<sheetViews><sheetView workbookViewId="0"><pane' +
    (columns > 0 ? ` xSplit="${String(columns)}"` : "") +
    (rows > 0 ? ` ySplit="${String(rows)}"` : "") +
    ` topLeftCell="${cellName(rows, columns)}" state="frozen"/></sheetView></sheetViews>`
  );
}

function columnsXml(sheet: SheetData): string {
  const columns = Object.entries(sheet.columnData ?? {})
    .map(([index, data]) => ({ index: Number(index), ...data }))
    .filter((c) => c.w !== undefined || c.hd === 1)
    .sort((a, b) => a.index - b.index)
    .map(
      (c) =>
        `<col min="${String(c.index + 1)}" max="${String(c.index + 1)}"` +
        (c.w === undefined
          ? ""
          : ` width="${(c.w / pixelsPerWidth).toFixed(2)}" customWidth="1"`) +
        (c.hd === 1 ? ' hidden="1"' : "") +
        "/>",
    )
    .join("");

  return columns === "" ? "" : `<cols>${columns}</cols>`;
}

function rowsXml(
  sheet: SheetData,
  named: Readonly<Record<string, StyleData>>,
  styles: StyleWriter,
): string {
  const cells = sheet.cellData ?? {};
  const shared = sharedFormulas(cells);
  const rows = new Set([
    ...Object.keys(cells).map(Number),
    ...Object.keys(sheet.rowData ?? {}).map(Number),
  ]);

  return [...rows]
    .sort((a, b) => a - b)
    .map((row) => {
      const data = sheet.rowData?.[row];
      const body = Object.entries(cells[row] ?? {})
        .map(([column, cell]) => ({ column: Number(column), cell }))
        .sort((a, b) => a.column - b.column)
        .map(({ column, cell }) =>
          cellXml(row, column, cell, shared, named, styles),
        )
        .join("");

      return (
        `<row r="${String(row + 1)}"` +
        (data?.h === undefined
          ? ""
          : ` ht="${(data.h * pointsPerPixel).toFixed(2)}" customHeight="1"`) +
        (data?.hd === 1 ? ' hidden="1"' : "") +
        `>${body}</row>`
      );
    })
    .join("");
}

interface SharedFormula {
  text: string;
  row: number;
  column: number;
}

// The cell that holds the text of each shared formula, by the id the other cells name.
function sharedFormulas(
  cells: Readonly<Record<number, Record<number, CellData>>>,
): Map<string, SharedFormula> {
  const shared = new Map<string, SharedFormula>();

  for (const [row, columns] of Object.entries(cells))
    for (const [column, cell] of Object.entries(columns))
      if (
        typeof cell.si === "string" &&
        typeof cell.f === "string" &&
        cell.f !== ""
      )
        shared.set(cell.si, {
          text: cell.f,
          row: Number(row),
          column: Number(column),
        });

  return shared;
}

function formulaOf(
  row: number,
  column: number,
  cell: CellData,
  shared: ReadonlyMap<string, SharedFormula>,
): string | undefined {
  if (typeof cell.f === "string" && cell.f !== "")
    return cell.f.replace(/^=/, "");

  const origin = typeof cell.si === "string" ? shared.get(cell.si) : undefined;
  if (origin === undefined) return undefined;

  return shiftFormula(
    origin.text.replace(/^=/, ""),
    row - origin.row,
    column - origin.column,
  );
}

function cellXml(
  row: number,
  column: number,
  cell: CellData,
  shared: ReadonlyMap<string, SharedFormula>,
  named: Readonly<Record<string, StyleData>>,
  styles: StyleWriter,
): string {
  const style = styles.register(
    typeof cell.s === "string" ? named[cell.s] : cell.s,
  );
  const open = `<c r="${columnName(column)}${String(row + 1)}"${style === 0 ? "" : ` s="${String(style)}"`}`;
  const formula = formulaOf(row, column, cell, shared);
  const value = cell.p?.body?.dataStream?.replace(/\r\n$/, "") ?? cell.v;
  const f = formula === undefined ? "" : `<f>${escapeXml(formula)}</f>`;

  if (typeof value === "number" && Number.isFinite(value))
    return `${open}>${f}<v>${String(value)}</v></c>`;

  if (typeof value === "boolean")
    return `${open} t="b">${f}<v>${value ? "1" : "0"}</v></c>`;

  if (typeof value === "string" && value !== "")
    return formula === undefined
      ? `${open} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
      : `${open} t="str">${f}<v>${escapeXml(value)}</v></c>`;

  return f === "" && style === 0 ? "" : `${open}>${f}</c>`;
}
