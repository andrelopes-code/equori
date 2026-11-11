import {
  dateLayouts,
  detectStructure,
  isAmountShaped,
  numberForm,
  parseCsvDate,
} from "@/features/accounts";

export interface PriceSeries {
  columns: string[]; // header names, or "1", "2", … without a header
  dateColumn: string | null;
  valueColumn: string | null;
  prices: { date: string; value: string }[]; // ISO dates ascending, decimal strings
  skipped: { line: number; text: string }[];
}

interface Line {
  line: number;
  cells: string[];
}

interface NumberForm {
  decimal: "," | ".";
  group: string;
}

const maxDecimals = 12;
const aroundValue = /^[\p{Sc}\p{L}\s]+|[\p{Sc}\p{L}\s]+$/gu;

export function readPriceSeries(
  text: string,
  choice: { dateColumn?: string; valueColumn?: string } = {},
): PriceSeries {
  const { rows, headerRows = 0 } = detectStructure(text);
  const header = headerRows > 0 ? rows[headerRows - 1] : undefined;
  const lines = rows.map((cells, i) => ({ line: i + 1, cells }));
  const data = lines.slice(headerRows);
  const width = Math.max(0, ...rows.map((row) => row.length));
  const columns =
    header ?? Array.from({ length: width }, (_, i) => String(i + 1));

  const dateIndex = pickDateColumn(columns, data, choice.dateColumn);
  const valueIndex = pickValueColumn(
    columns,
    data,
    dateIndex,
    choice.valueColumn,
  );
  const name = (i: number): string | null => columns[i] ?? null;
  if (dateIndex < 0 || valueIndex < 0) {
    return {
      columns,
      dateColumn: name(dateIndex),
      valueColumn: name(valueIndex),
      prices: [],
      skipped: [],
    };
  }

  const layout = columnLayouts(columnCells(data, dateIndex))[0];
  const form = numberForm(columnCells(data, valueIndex)) ?? {
    decimal: ".",
    group: "",
  };
  const read = readLines(data, dateIndex, valueIndex, layout, form);

  return {
    columns,
    dateColumn: name(dateIndex),
    valueColumn: name(valueIndex),
    prices: read.prices.sort((a, b) => a.date.localeCompare(b.date)),
    skipped: read.skipped,
  };
}

function pickDateColumn(
  columns: string[],
  data: Line[],
  chosen: string | undefined,
): number {
  if (chosen !== undefined) return columns.indexOf(chosen);

  return columns.findIndex(
    (_, i) => columnLayouts(columnCells(data, i)).length > 0,
  );
}

function pickValueColumn(
  columns: string[],
  data: Line[],
  dateIndex: number,
  chosen: string | undefined,
): number {
  if (chosen !== undefined) return columns.indexOf(chosen);

  return columns.findIndex((_, i) => {
    const cells = columnCells(data, i).filter((c) => c.trim() !== "");
    return i !== dateIndex && cells.length > 0 && cells.every(isAmountShaped);
  });
}

function readLines(
  data: Line[],
  dateIndex: number,
  valueIndex: number,
  layout: string | undefined,
  form: NumberForm,
): Pick<PriceSeries, "prices" | "skipped"> {
  const prices: PriceSeries["prices"] = [];
  const skipped: PriceSeries["skipped"] = [];
  const seen = new Set<string>();

  for (const { line, cells } of data) {
    const date = parseCsvDate(cells[dateIndex] ?? "", layout);
    const value = normalizeValue(cells[valueIndex] ?? "", form);
    if (date === undefined || value === undefined || seen.has(date)) {
      skipped.push({ line, text: cells.join(" | ") });
      continue;
    }
    seen.add(date);
    prices.push({ date, value });
  }

  return { prices, skipped };
}

function columnCells(data: Line[], index: number): string[] {
  return data.map(({ cells }) => cells[index] ?? "");
}

// Layouts that read every cell that reads as a date under any layout: a total row or a stray
// text in the column does not hide the dates; a row that does not read is skipped later.
function columnLayouts(cells: string[]): string[] {
  return dateLayouts(cells.filter((c) => dateLayouts([c]).length > 0));
}

// A positive decimal with at most 12 decimals, or undefined.
function normalizeValue(text: string, form: NumberForm): string | undefined {
  const bare = text.replace(aroundValue, "").replace(/\s/gu, "");
  const plain = form.group === "" ? bare : bare.split(form.group).join("");
  const [whole = "", fraction = "", ...rest] = plain.split(form.decimal);
  const decimals = fraction.replace(/0+$/u, "");
  const digits = whole + decimals;
  const valid =
    rest.length === 0 && /^\d+$/u.test(whole) && /^\d*$/u.test(fraction);
  if (!valid || decimals.length > maxDecimals || !/[1-9]/u.test(digits)) {
    return undefined;
  }

  const integer = whole.replace(/^0+(?=\d)/u, "");

  return decimals === "" ? integer : `${integer}.${decimals}`;
}
