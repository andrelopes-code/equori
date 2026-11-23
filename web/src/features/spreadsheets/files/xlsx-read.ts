import { strFromU8, unzipSync } from "fflate";

import type {
  CellData,
  SheetData,
  WorkbookData,
} from "@/features/spreadsheets/files/snapshot";
import {
  cellPosition,
  shiftFormula,
} from "@/features/spreadsheets/files/xlsx-refs";
import { readStyles } from "@/features/spreadsheets/files/xlsx-style-reader";

// The grid of a sheet read from a file: at least the grid of a new sheet, and room past the
// last cell of the file.
const minRows = 1000;
const minColumns = 26;
const spareRows = 100;
const spareColumns = 5;

const pixelsPerWidth = 7;
const pointsPerPixel = 0.75;

// The file is not an XLSX workbook: not a ZIP, or without the parts every workbook holds.
export class NotXlsxError extends Error {
  constructor() {
    super("not an XLSX workbook");
    this.name = "NotXlsxError";
  }
}

// The workbook snapshot of an XLSX file: the sheets with their values, formulas, number
// formats, fonts, fills, borders, alignment, merged cells, sizes and frozen panes. Charts,
// images, comments, validation and conditional formats of the file are not read.
export function readXlsx(bytes: Uint8Array): WorkbookData {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new NotXlsxError();
  }

  const part = (path: string): Document | undefined => {
    const file = files[path.replace(/^\//, "")];

    return file === undefined
      ? undefined
      : new DOMParser().parseFromString(strFromU8(file), "application/xml");
  };

  const workbook = part("xl/workbook.xml");
  const relations = part("xl/_rels/workbook.xml.rels");
  if (workbook === undefined || relations === undefined)
    throw new NotXlsxError();

  const strings = readSharedStrings(part("xl/sharedStrings.xml"));
  const stylesPart = part("xl/styles.xml");
  const styles = stylesPart === undefined ? [] : readStyles(stylesPart);
  const targets = new Map(
    elements(relations, "Relationship").map((r) => [
      r.getAttribute("Id") ?? "",
      r.getAttribute("Target") ?? "",
    ]),
  );

  const out: Required<WorkbookData> = {
    sheetOrder: [],
    sheets: {},
    styles: {},
  };

  // The first style is the default of the file's own application (its font and size); a cell
  // that names it takes the default of the editor instead.
  styles.forEach((style, i) => {
    if (i > 0 && Object.keys(style).length > 0) out.styles[styleID(i)] = style;
  });

  elements(workbook, "sheet").forEach((entry, i) => {
    const target = targets.get(entry.getAttribute("r:id") ?? "") ?? "";
    const path = target.startsWith("/") ? target : `xl/${target}`;
    const document = part(path);
    if (document === undefined) return;

    const id = `sheet-${String(i + 1)}`;
    const sheet = readSheet(document, strings, out.styles);

    out.sheetOrder.push(id);
    out.sheets[id] = {
      ...sheet,
      id,
      name: entry.getAttribute("name") ?? id,
      ...(entry.getAttribute("state") === "hidden" ? { hidden: 1 } : {}),
    };
  });

  if (out.sheetOrder.length === 0) throw new NotXlsxError();

  return out;
}

function styleID(index: number): string {
  return `x${String(index)}`;
}

function elements(root: Document | Element, name: string): Element[] {
  return [...root.getElementsByTagName(name)];
}

// The text of each shared string: its runs joined, without the phonetic guide of a run.
function readSharedStrings(document: Document | undefined): string[] {
  if (document === undefined) return [];

  return elements(document, "si").map(textOf);
}

function textOf(item: Element): string {
  return elements(item, "t")
    .filter((t) => t.parentElement?.localName !== "rPh")
    .map((t) => t.textContent)
    .join("");
}

function readSheet(
  document: Document,
  strings: readonly string[],
  styles: Readonly<Record<string, unknown>>,
): Omit<SheetData, "id" | "name"> {
  const cellData: Record<number, Record<number, CellData>> = {};
  const rowData: NonNullable<SheetData["rowData"]> = {};
  const shared = new Map<
    string,
    { text: string; row: number; column: number }
  >();
  let lastRow = 0;
  let lastColumn = 0;

  for (const rowElement of elements(document, "row")) {
    const height = Number(rowElement.getAttribute("ht"));
    const rowIndex = Number(rowElement.getAttribute("r")) - 1;

    if (rowElement.getAttribute("customHeight") === "1" && height > 0)
      rowData[rowIndex] = { h: Math.round(height / pointsPerPixel) };
    if (rowElement.getAttribute("hidden") === "1")
      rowData[rowIndex] = { ...rowData[rowIndex], hd: 1 };

    for (const c of elements(rowElement, "c")) {
      const { row, column } = cellPosition(c.getAttribute("r") ?? "A1");
      const cell = readCell(c, row, column, strings, styles, shared);
      if (cell === undefined) continue;

      (cellData[row] ??= {})[column] = cell;
      lastRow = Math.max(lastRow, row);
      lastColumn = Math.max(lastColumn, column);
    }
  }

  const pane = elements(document, "pane").find(
    (p) => p.getAttribute("state") === "frozen",
  );
  const xSplit = Number(pane?.getAttribute("xSplit") ?? 0);
  const ySplit = Number(pane?.getAttribute("ySplit") ?? 0);

  return {
    cellData,
    rowData,
    columnData: readColumns(document),
    mergeData: elements(document, "mergeCell").map((m) => {
      const [from = "A1", to = from] = (m.getAttribute("ref") ?? "A1").split(
        ":",
      );
      const start = cellPosition(from);
      const end = cellPosition(to);

      return {
        startRow: start.row,
        startColumn: start.column,
        endRow: end.row,
        endColumn: end.column,
      };
    }),
    rowCount: Math.max(minRows, lastRow + 1 + spareRows),
    columnCount: Math.max(minColumns, lastColumn + 1 + spareColumns),
    ...(pane === undefined
      ? {}
      : { freeze: { xSplit, ySplit, startRow: ySplit, startColumn: xSplit } }),
  };
}

function readColumns(document: Document): NonNullable<SheetData["columnData"]> {
  const columns: NonNullable<SheetData["columnData"]> = {};

  for (const col of elements(document, "col")) {
    const width = Number(col.getAttribute("width"));
    const hidden = col.getAttribute("hidden") === "1";
    const sized = col.getAttribute("customWidth") === "1" && width > 0;
    if (!hidden && !sized) continue;

    // A file may size every column to the last one with a single entry; the grid of the
    // editor holds far fewer columns.
    const first = Number(col.getAttribute("min")) - 1;
    const last = Math.min(Number(col.getAttribute("max")) - 1, first + 255);

    for (let i = first; i <= last; i++)
      columns[i] = {
        ...(sized ? { w: Math.round(width * pixelsPerWidth) } : {}),
        ...(hidden ? { hd: 1 } : {}),
      };
  }

  return columns;
}

function readCell(
  c: Element,
  row: number,
  column: number,
  strings: readonly string[],
  styles: Readonly<Record<string, unknown>>,
  shared: Map<string, { text: string; row: number; column: number }>,
): CellData | undefined {
  const cell: CellData = {};
  const style = styleID(Number(c.getAttribute("s") ?? 0));
  const formula = readFormula(c, row, column, shared);
  const raw = [...c.children].find((e) => e.localName === "v")?.textContent;
  const type = c.getAttribute("t") ?? "n";

  if (style in styles) cell.s = style;
  if (formula !== undefined) cell.f = `=${formula}`;

  if (type === "inlineStr") {
    cell.v = textOf(c);
    cell.t = 1;
  } else if (raw !== undefined && raw !== "") {
    if (type === "s") {
      cell.v = strings[Number(raw)] ?? "";
      cell.t = 1;
    } else if (type === "b") {
      cell.v = raw === "1";
      cell.t = 3;
    } else if (type === "n" && Number.isFinite(Number(raw))) {
      cell.v = Number(raw);
      cell.t = 2;
    } else {
      cell.v = raw;
      cell.t = 1;
    }
  }

  return Object.keys(cell).length === 0 ? undefined : cell;
}

// The formula of a cell, without its "=". A shared formula is written once, in the first cell
// of its range; each other cell names it and takes its text moved to its own position.
function readFormula(
  c: Element,
  row: number,
  column: number,
  shared: Map<string, { text: string; row: number; column: number }>,
): string | undefined {
  const f = [...c.children].find((e) => e.localName === "f");
  if (f === undefined) return undefined;

  const text = f.textContent;
  const id = f.getAttribute("t") === "shared" ? f.getAttribute("si") : null;

  if (id === null) return text === "" ? undefined : text;

  if (text !== "") {
    shared.set(id, { text, row, column });
    return text;
  }

  const origin = shared.get(id);

  return origin === undefined
    ? undefined
    : shiftFormula(origin.text, row - origin.row, column - origin.column);
}
