// The part of a workbook snapshot of Univer that a file carries. The editor writes and reads
// many more fields; a file keeps the ones below.

export interface ColorData {
  rgb?: string | null;
}

export interface BorderEdge {
  // BorderStyleTypes of Univer: 1 thin, 8 medium, 13 thick, 4 dashed, 3 dotted, 7 double.
  s: number;
  cl?: ColorData;
}

export interface StyleData {
  ff?: string | null;
  fs?: number;
  it?: number;
  bl?: number;
  ul?: { s: number };
  st?: { s: number };
  cl?: ColorData | null;
  bg?: ColorData | null;
  bd?: Partial<Record<"t" | "r" | "b" | "l", BorderEdge | null>> | null;
  n?: { pattern: string } | null;
  // HorizontalAlign: 1 left, 2 center, 3 right. VerticalAlign: 1 top, 2 middle, 3 bottom.
  ht?: number | null;
  vt?: number | null;
  // WrapStrategy: 3 wraps the text.
  tb?: number | null;
}

export interface CellData {
  v?: string | number | boolean | null;
  f?: string | null;
  // The id of a formula shared with the cell that holds its text.
  si?: string | null;
  s?: string | StyleData | null;
  // CellValueType: 1 text, 2 number, 3 boolean, 4 text kept as typed.
  t?: number | null;
  p?: { body?: { dataStream?: string } } | null;
}

export interface CellRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface SheetData {
  id: string;
  name: string;
  hidden?: number;
  rowCount?: number;
  columnCount?: number;
  cellData?: Record<number, Record<number, CellData>>;
  mergeData?: CellRange[];
  rowData?: Record<number, { h?: number; hd?: number }>;
  columnData?: Record<number, { w?: number; hd?: number }>;
  freeze?: {
    xSplit: number;
    ySplit: number;
    startRow: number;
    startColumn: number;
  };
}

export interface WorkbookData {
  sheetOrder?: string[];
  sheets?: Record<string, SheetData>;
  styles?: Record<string, StyleData>;
}
