import { splitCsv } from "@/features/accounts/csv-preview";

export interface CsvStructure {
  delimiter: "comma" | "semicolon" | "tab" | "pipe";
  headerRows: number | undefined;
  footerRows: number;
  rows: string[][]; // non-blank rows of the file, split by the delimiter
}

const candidates = [
  ["semicolon", ";"],
  ["comma", ","],
  ["tab", "\t"],
  ["pipe", "|"],
] as const;

const surveyed = 50;
const maxFooterRows = 10;

const datePattern = /^\d{1,4}[/. -]\d{1,2}[/. -]\d{1,4}\b/u;
const amountPattern =
  /^[\p{Sc}\s+\-().,']*\d[\d.,'\s+\-()\p{Sc}]*(?:\s*\p{L}+(?:\s+\p{L}+)?)?$/u;

export function detectStructure(text: string): CsvStructure {
  const { delimiter, rows, width } = pickDelimiter(text);
  const start = rows.findIndex((row) => row.length === width);
  if (start < 0) {
    return { delimiter, headerRows: undefined, footerRows: 0, rows };
  }

  const first = rows[start] ?? [];
  const isHeader = !first.some((c) => isDateShaped(c) || isAmountShaped(c));
  let headerRows: number | undefined;
  if (isHeader) headerRows = start + 1;
  else if (start === 0) headerRows = 0;

  return {
    delimiter,
    headerRows,
    footerRows: footerRows(rows, width, isHeader ? start + 1 : start),
    rows,
  };
}

export function isDateShaped(cell: string): boolean {
  return datePattern.test(cell.trim());
}

export function isAmountShaped(cell: string): boolean {
  return amountPattern.test(cell.trim());
}

// The delimiter whose most frequent field count above 1 holds the most of the first rows.
function pickDelimiter(text: string): {
  delimiter: CsvStructure["delimiter"];
  rows: string[][];
  width: number;
} {
  let best = {
    delimiter: "comma" as CsvStructure["delimiter"],
    rows: splitNonBlank(text, ","),
    width: 0,
    count: 0,
  };
  for (const [name, char] of candidates) {
    const rows = splitNonBlank(text, char);
    const tally = new Map<number, number>();
    for (const row of rows.slice(0, surveyed)) {
      if (row.length > 1)
        tally.set(row.length, (tally.get(row.length) ?? 0) + 1);
    }
    for (const [width, count] of tally) {
      if (count > best.count) best = { delimiter: name, rows, width, count };
    }
  }
  return best;
}

function splitNonBlank(text: string, char: string): string[][] {
  return splitCsv(
    text.startsWith("\uFEFF") ? text.slice(1) : text,
    char,
  ).filter((row) => row.some((cell) => cell.trim() !== ""));
}

// Rows from the end that are not data: another field count, or no date-shaped cell. Counted only
// when the first data row holds a date-shaped cell.
function footerRows(
  rows: string[][],
  width: number,
  firstData: number,
): number {
  if (!(rows[firstData] ?? []).some(isDateShaped)) return 0;

  let count = 0;
  for (
    let i = rows.length - 1;
    i > firstData && count < maxFooterRows;
    i -= 1
  ) {
    const row = rows[i] ?? [];
    if (row.length === width && row.some(isDateShaped)) break;
    count += 1;
  }
  return count;
}
