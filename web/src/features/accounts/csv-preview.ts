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
  const tokens = layout.split(/[/. -]/u);
  const separator = layout.charAt(tokens[0]?.length ?? 0);
  // domain.DateLayout.Parse: a time after the date is dropped unless the layout has spaces.
  const written = separator === " " ? text : (text.split(/[ T]/u, 1)[0] ?? "");
  const m = new RegExp(
    `^${tokens
      .map((t) =>
        t === "DD" || t === "MM" ? "(\\d{1,2})" : `(\\d{${String(t.length)}})`,
      )
      .join(`[${separator}]`)}$`,
    "u",
  ).exec(written);
  if (m === null || tokens.length !== 3) return undefined;
  const part = (kind: string): string => {
    const i = tokens.findIndex((t) => t.startsWith(kind));
    return m[i + 1] ?? "";
  };
  const shortYear = part("YY");
  const year = shortYear.length === 2 ? `20${shortYear}` : shortYear;
  const month = part("MM").padStart(2, "0");
  const day = part("DD").padStart(2, "0");
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(iso)
    ? iso
    : undefined;
}

// domain.MinorUnits, with domain.isAffix as the trimmed set: a currency symbol or code around the number is ignored; parentheses around
// it or a trailing minus sign make it negative. group is "" for none.
export function minorUnits(
  text: string,
  decimal: "," | ".",
  group: string,
  scale: number,
): number | undefined {
  let v = trimAffix(text);
  let negative = false;
  if (v.startsWith("(") && v.endsWith(")")) {
    v = trimAffix(v.slice(1, -1));
    negative = true;
  }
  if (v.endsWith("-")) {
    v = trimAffix(v.slice(0, -1));
    negative = true;
  }
  v = v.replace(/\s/gu, "");
  if (group !== "") v = v.split(group).join("");
  if (v === "") return undefined;
  if (v.startsWith("-")) {
    if (negative) return undefined;
    negative = true;
    v = v.slice(1);
  } else if (v.startsWith("+")) {
    v = v.slice(1);
  }
  const cut = v.indexOf(decimal);
  const whole = cut < 0 ? v : v.slice(0, cut);
  const frac = (cut < 0 ? "" : v.slice(cut + 1)).replace(/0+$/u, "");
  if (whole === "" || frac.length > scale || !/^\d+$/u.test(whole + frac)) {
    return undefined;
  }
  const n = Number(whole + frac + "0".repeat(scale - frac.length));
  if (!Number.isSafeInteger(n)) return undefined;
  return negative && n !== 0 ? -n : n;
}

// The first lines of a CSV file read the way the server will read them with the profile, so the
// reader sees each column land before the file is sent.
export function previewCsv(
  text: string,
  profile: ProfileParts,
  scale: number,
  limit = 10,
): CsvPreview {
  const { headers, rows, problem } = readRows(text, profile, scale);
  return { headers, rows: rows.slice(0, limit), problem };
}

export interface CsvCounts {
  unreadable: number;
  moneyIn: number;
  moneyOut: number;
}

// Every line of the file read with the profile: the lines the server cannot read, and the lines
// that bring money in or take it out.
export function countCsv(
  text: string,
  profile: ProfileParts,
  scale: number,
): CsvCounts {
  const counts: CsvCounts = { unreadable: 0, moneyIn: 0, moneyOut: 0 };
  for (const row of readRows(text, profile, scale).rows) {
    if (row.problems.length > 0) counts.unreadable += 1;
    else if ((row.amount ?? 0) > 0) counts.moneyIn += 1;
    else if ((row.amount ?? 0) < 0) counts.moneyOut += 1;
  }
  return counts;
}

function readRows(
  text: string,
  profile: ProfileParts,
  scale: number,
): CsvPreview {
  const decimal = profile.decimal_separator ?? ",";
  const group = profile.group_separator ?? (decimal === "," ? "." : ",");
  const all = splitCsv(
    text.replace(/^\uFEFF/u, ""),
    delimiters[profile.delimiter ?? "comma"],
  );
  const headerRows = profile.header_rows ?? 1;
  const header = headerRows > 0 ? all[headerRows - 1] : undefined;
  const lines = all
    .slice(headerRows)
    .filter((row) => row.some((cell) => cell.trim() !== ""));
  const body = lines.slice(
    0,
    Math.max(0, lines.length - (profile.footer_rows ?? 0)),
  );
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
  const sign = index("sign_column", profile.sign_column);
  const cell = (row: string[], i: number) =>
    i < 0 ? "" : (row[i] ?? "").trim();
  // The sign column, or the letters after the amount.
  const marker = (row: string[]) =>
    sign >= 0
      ? cell(row, sign)
      : (/\p{L}*$/u.exec(cell(row, amount))?.[0] ?? "");
  const marked = (row: string[]) =>
    (profile.debit_marker ?? "") !== "" &&
    marker(row).toLowerCase() === (profile.debit_marker ?? "").toLowerCase();

  const rows = body.map((row): PreviewRow => {
    const problems: PreviewRow["problems"] = [];
    const day = parseDate(cell(row, date), profile.date_layout);
    if (day === undefined) problems.push("date");
    let value: number | undefined;
    if (profile.amount_column !== undefined && profile.amount_column !== "") {
      value = minorUnits(cell(row, amount), decimal, group, scale);
      if (value !== undefined && marked(row)) value = -Math.abs(value);
    } else if (cell(row, debit) !== "") {
      const v = minorUnits(cell(row, debit), decimal, group, scale);
      value = v === undefined ? undefined : -Math.abs(v);
    } else {
      const v = minorUnits(cell(row, credit), decimal, group, scale);
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

function trimAffix(text: string): string {
  return text.replace(/^[\p{L}\p{Sc}\s]+|[\p{L}\p{Sc}\s]+$/gu, "");
}
