import type { components } from "@/api/schema.gen";

type CsvProfile = components["schemas"]["CsvProfile"];
// A profile still being set up: the preview reads whatever parts it has.
type ProfileParts = { [K in keyof CsvProfile]?: CsvProfile[K] | undefined };

export interface PreviewRow {
  date?: string;
  description?: string;
  amount?: number;
  problems: ("date" | "amount")[];
}

export interface CsvPreview {
  headers: string[];
  rows: PreviewRow[];
  // A column the profile names that the header does not hold.
  problem: { field: string; column: string } | null;
}

const delimiters: Record<NonNullable<CsvProfile["delimiter"]>, string> = {
  comma: ",",
  semicolon: ";",
  tab: "\t",
  pipe: "|",
};

// RFC 4180 with lazy quotes, as the server's reader takes it (encoding/csv, LazyQuotes).
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"' && text.charAt(i + 1) === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text.charAt(i + 1) === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseDate(
  text: string,
  layout: CsvProfile["date_layout"] | undefined,
): string | undefined {
  if (layout === undefined) return undefined;
  const patterns = {
    "DD/MM/YYYY": /^(\d{2})\/(\d{2})\/(\d{4})$/,
    "MM/DD/YYYY": /^(\d{2})\/(\d{2})\/(\d{4})$/,
    "YYYY-MM-DD": /^(\d{4})-(\d{2})-(\d{2})$/,
  };
  const m = patterns[layout].exec(text);
  if (m === null) return undefined;
  const [, a = "", b = "", c = ""] = m;
  const [year, month, day] =
    layout === "YYYY-MM-DD"
      ? [a, b, c]
      : layout === "DD/MM/YYYY"
        ? [c, b, a]
        : [c, a, b];
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(iso)
    ? iso
    : undefined;
}

// domain.MinorUnits: the other separator groups thousands; "R$" and spaces are dropped.
export function minorUnits(
  text: string,
  decimal: "," | ".",
  scale: number,
): number | undefined {
  const thousands = decimal === "," ? "." : ",";
  let v = text
    .trim()
    .replaceAll(" ", "")
    .replaceAll("\u00a0", "")
    .replaceAll("R$", "");
  v = v.split(thousands).join("");
  if (v === "") return undefined;
  let sign = 1;
  if (v.startsWith("-")) {
    sign = -1;
    v = v.slice(1);
  } else if (v.startsWith("+")) {
    v = v.slice(1);
  }
  const [whole = "", rawFrac = ""] = v.split(decimal, 2);
  const frac = rawFrac.replace(/0+$/u, "");
  if (
    whole === "" ||
    frac.length > scale ||
    !/^\d+$/u.test(whole + frac + "0")
  ) {
    return undefined;
  }
  const n = Number(whole + frac + "0".repeat(scale - frac.length));
  return Number.isSafeInteger(n) ? sign * n : undefined;
}

// The first lines of a CSV file read the way the server will read them with the profile, so the
// reader sees each column land before the file is sent.
export function previewCsv(
  text: string,
  profile: ProfileParts,
  scale: number,
  limit = 10,
): CsvPreview {
  const decimal = profile.decimal_separator ?? ",";
  const all = splitCsv(
    text.replace(/^\uFEFF/u, ""),
    delimiters[profile.delimiter ?? "comma"],
  );
  const headerRows = profile.header_rows ?? 1;
  const header = headerRows > 0 ? all[headerRows - 1] : undefined;
  const body = all
    .slice(headerRows)
    .filter((row) => row.some((cell) => cell.trim() !== ""));
  const width = Math.max(header?.length ?? 0, ...body.map((r) => r.length));
  const headers =
    header?.map((h) => h.trim()) ??
    Array.from({ length: width }, (_, i) => String(i + 1));
  let problem: CsvPreview["problem"] = null;
  const index = (field: string, name: string | undefined): number => {
    if (name === undefined || name === "") return -1;
    if (header === undefined) return Number(name) - 1;
    const i = header.findIndex(
      (h) => h.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (i < 0 && problem === null) problem = { field, column: name };
    return i;
  };
  const date = index("date_column", profile.date_column);
  const description = index("description_column", profile.description_column);
  const amount = index("amount_column", profile.amount_column);
  const debit = index("debit_column", profile.debit_column);
  const credit = index("credit_column", profile.credit_column);
  const cell = (row: string[], i: number) =>
    i < 0 ? "" : (row[i] ?? "").trim();

  const rows = body.slice(0, limit).map((row): PreviewRow => {
    const problems: PreviewRow["problems"] = [];
    const day = parseDate(cell(row, date), profile.date_layout);
    if (day === undefined) problems.push("date");
    let value: number | undefined;
    if (profile.amount_column !== undefined && profile.amount_column !== "") {
      value = minorUnits(cell(row, amount), decimal, scale);
    } else if (cell(row, debit) !== "") {
      const v = minorUnits(cell(row, debit), decimal, scale);
      value = v === undefined ? undefined : -Math.abs(v);
    } else {
      const v = minorUnits(cell(row, credit), decimal, scale);
      value = v === undefined ? undefined : Math.abs(v);
    }
    if (value === undefined) problems.push("amount");
    else if (profile.amount_sign === "inverted") value = -value;
    return {
      ...(day === undefined ? {} : { date: day }),
      description: cell(row, description),
      ...(value === undefined ? {} : { amount: value === 0 ? 0 : value }),
      problems,
    };
  });
  return { headers, rows, problem };
}
