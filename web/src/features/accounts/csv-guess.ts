import type { components } from "@/api/schema.gen";
import { splitCsv } from "@/features/accounts/csv-preview";
import {
  dateLayouts,
  distinctValues,
  markerTokens,
  numberForm,
} from "@/features/accounts/csv-shape";
import {
  detectStructure,
  isAmountShaped,
} from "@/features/accounts/csv-structure";

type CsvProfile = components["schemas"]["CsvProfile"];
type CsvColumnSuggestion = components["schemas"]["CsvColumnSuggestion"];

const sampleRows = 12;
const sampleCells = 40;
const sampleChars = 200;

// Every part of a profile may still be missing while the reader sets it up.
export type ProfileDraft = {
  [K in keyof CsvProfile]?: CsvProfile[K] | undefined;
};

const delimiterChars = [
  ["semicolon", ";"],
  ["comma", ","],
  ["tab", "\t"],
  ["pipe", "|"],
] as const;

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

const columnWords: {
  field:
    | "date_column"
    | "description_column"
    | "amount_column"
    | "id_column"
    | "debit_column"
    | "credit_column";
  pattern: RegExp;
}[] = [
  { field: "date_column", pattern: /^(data|date|dt)\b/u },
  {
    field: "description_column",
    pattern: /(descri|historico|memo|lancamento|estabelecimento|title)/u,
  },
  { field: "amount_column", pattern: /^(valor|amount|value|quantia)\b/u },
  { field: "id_column", pattern: /^(id|identificador|documento|fitid)$/u },
  { field: "debit_column", pattern: /^(debito|debit|saida)\b/u },
  { field: "credit_column", pattern: /^(credito|credit|entrada)\b/u },
];

const standardLayouts = ["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"];

// What a new account's CSV profile starts from: the structure and the number form of the file,
// and the roles of its columns from their header words, then from their shape (spec section 4).
export function guessProfile(text: string): ProfileDraft {
  const { delimiter, headerRows, footerRows, rows } = detectStructure(text);
  const draft: ProfileDraft = { delimiter, amount_sign: "as_is" };
  if (headerRows === undefined) return draft;

  draft.header_rows = headerRows;
  if (footerRows > 0) draft.footer_rows = footerRows;
  const data = rows
    .slice(headerRows)
    .filter((row) => row.some((cell) => cell.trim() !== ""));
  const body = data.slice(0, Math.max(0, data.length - footerRows));
  const names =
    headerRows > 0
      ? (rows[headerRows - 1] ?? []).map((cell) => cell.trim())
      : Array.from(
          { length: body.reduce((w, r) => Math.max(w, r.length), 0) },
          (_, i) => String(i + 1),
        );
  const columns = names.map((_, i) => body.map((row) => row[i] ?? ""));
  assignByWords(draft, names);
  assignByShape(draft, names, columns);
  setNumberForm(draft, names, columns);

  return draft;
}

// The profile the server takes, once every required part holds a value.
export function completeProfile(draft: ProfileDraft): CsvProfile | null {
  const amountReady =
    (draft.amount_column ?? "") !== "" ||
    ((draft.debit_column ?? "") !== "" && (draft.credit_column ?? "") !== "");
  if (
    draft.date_column === undefined ||
    draft.date_column === "" ||
    draft.description_column === undefined ||
    draft.description_column === "" ||
    draft.date_layout === undefined ||
    draft.decimal_separator === undefined ||
    !amountReady ||
    ((draft.sign_column ?? "") !== "" && (draft.debit_marker ?? "") === "")
  ) {
    return null;
  }
  return {
    delimiter: draft.delimiter ?? "comma",
    header_rows: draft.header_rows ?? 1,
    date_column: draft.date_column,
    date_layout: draft.date_layout,
    ...((draft.amount_column ?? "") !== ""
      ? { amount_column: draft.amount_column }
      : {
          debit_column: draft.debit_column,
          credit_column: draft.credit_column,
        }),
    decimal_separator: draft.decimal_separator,
    description_column: draft.description_column,
    ...((draft.id_column ?? "") === "" ? {} : { id_column: draft.id_column }),
    amount_sign: draft.amount_sign ?? "as_is",
    ...(draft.encoding === undefined ? {} : { encoding: draft.encoding }),
    ...(draft.group_separator === undefined
      ? {}
      : { group_separator: draft.group_separator }),
    ...(draft.footer_rows === undefined
      ? {}
      : { footer_rows: draft.footer_rows }),
    ...((draft.sign_column ?? "") === ""
      ? {}
      : { sign_column: draft.sign_column }),
    ...((draft.debit_marker ?? "") === ""
      ? {}
      : { debit_marker: draft.debit_marker }),
  } as CsvProfile;
}

// The profile the server takes, once it is complete and no letter mark in the amount column is
// left unnamed.
export function readyProfile(
  text: string,
  draft: ProfileDraft,
): CsvProfile | null {
  return draftNeedsMarker(text, draft) ? null : completeProfile(draft);
}

// Whether two profiles hold the same values, whatever the order of their keys.
export function sameProfile(
  a: CsvProfile | null | undefined,
  b: CsvProfile | null,
): boolean {
  if (a === null || a === undefined || b === null) return false;
  const entries = (p: CsvProfile) =>
    JSON.stringify(Object.entries(p).sort(([x], [y]) => x.localeCompare(y)));
  return entries(a) === entries(b);
}

// What the column suggestion sends: the header and the first data rows, cut to a bounded size.
export function csvSample(
  text: string,
  draft: ProfileDraft,
): { header?: string[]; rows: string[][] } {
  const { header, body } = tableOf(text, draft);
  const cut = (row: string[]) =>
    row.slice(0, sampleCells).map((cell) => cell.slice(0, sampleChars));
  const rows = body.slice(0, sampleRows).map(cut);

  return header === undefined ? { rows } : { header: cut(header), rows };
}

// The draft with the columns the model named. Only column fields change, then the date layout and
// the number form are derived again from the file.
export function applySuggestion(
  text: string,
  draft: ProfileDraft,
  suggestion: CsvColumnSuggestion,
): ProfileDraft {
  const next: ProfileDraft = {
    ...draft,
    date_column: suggestion.date_column,
    description_column: suggestion.description_column,
  };
  if ((suggestion.amount_column ?? "") !== "") {
    next.amount_column = suggestion.amount_column;
    delete next.debit_column;
    delete next.credit_column;
  } else {
    next.debit_column = suggestion.debit_column;
    next.credit_column = suggestion.credit_column;
    delete next.amount_column;
    delete next.sign_column;
    delete next.debit_marker;
  }
  if ((suggestion.id_column ?? "") !== "")
    next.id_column = suggestion.id_column;
  if ((suggestion.sign_column ?? "") !== "") {
    if (suggestion.sign_column !== draft.sign_column) delete next.debit_marker;
    next.sign_column = suggestion.sign_column;
  }

  const layouts = dateLayouts(columnCells(text, next, next.date_column));
  if (layouts.length === 1) next.date_layout = layouts[0];
  else delete next.date_layout;

  const cells = [
    next.amount_column,
    next.debit_column,
    next.credit_column,
  ].flatMap((column) => columnCells(text, next, column));
  const form = numberForm(cells);
  if (form !== undefined) {
    next.decimal_separator = form.decimal;
    const defaultGroup = form.decimal === "," ? "." : ",";
    if (form.group !== "" && form.group !== defaultGroup) {
      next.group_separator = form.group;
    }
  }

  return next;
}

// Whether the amount column carries a letter mark the profile has not named as the debit mark.
export function draftNeedsMarker(text: string, draft: ProfileDraft): boolean {
  return (
    (draft.debit_marker ?? "") === "" &&
    (draft.sign_column ?? "") === "" &&
    markerTokens(columnCells(text, draft, draft.amount_column)).length > 0
  );
}

// The values the person picks the debit mark from: those of the sign column, else the letters
// after the number in the amount column.
export function markerChoices(text: string, draft: ProfileDraft): string[] {
  return (draft.sign_column ?? "") === ""
    ? markerTokens(columnCells(text, draft, draft.amount_column))
    : distinctValues(columnCells(text, draft, draft.sign_column));
}

// The layouts the date column reads under, then the standard ones and the current value, once each.
export function dateLayoutChoices(text: string, draft: ProfileDraft): string[] {
  const found = dateLayouts(columnCells(text, draft, draft.date_column));
  const current = (draft.date_layout ?? "") === "" ? [] : [draft.date_layout];

  return [...new Set([...found, ...standardLayouts, ...current])] as string[];
}

function tableOf(
  text: string,
  draft: ProfileDraft,
): { header: string[] | undefined; body: string[][] } {
  const char =
    delimiterChars.find(([name]) => name === draft.delimiter)?.[1] ?? ",";
  // encoding/csv skips an empty line and reads a line of delimiters as a row.
  const all = splitCsv(text.replace(/^\uFEFF/u, ""), char).filter(
    (row) => row.length > 1 || row[0] !== "",
  );
  const headerRows = draft.header_rows ?? 1;
  const data = all
    .slice(headerRows)
    .filter((row) => row.some((cell) => cell.trim() !== ""));

  return {
    header: headerRows > 0 ? all[headerRows - 1] : undefined,
    body: data.slice(0, Math.max(0, data.length - (draft.footer_rows ?? 0))),
  };
}

function columnCells(
  text: string,
  draft: ProfileDraft,
  column: string | undefined,
): string[] {
  if (column === undefined || column === "") return [];
  const { header, body } = tableOf(text, draft);
  const index =
    header === undefined
      ? Number(column) - 1
      : header.findIndex(
          (h) => h.trim().toLowerCase() === column.trim().toLowerCase(),
        );
  if (index < 0) return [];

  return body.map((row) => row[index] ?? "");
}

function assignByWords(draft: ProfileDraft, names: string[]): void {
  for (const { field, pattern } of columnWords) {
    const name = names.find((h) => pattern.test(plain(h)));
    if (name !== undefined) draft[field] = name;
  }
}

function assignByShape(
  draft: ProfileDraft,
  names: string[],
  columns: string[][],
): void {
  const free = () => {
    const taken = [
      draft.date_column,
      draft.description_column,
      draft.amount_column,
      draft.id_column,
      draft.debit_column,
      draft.credit_column,
    ];
    return columns.flatMap((_, i) =>
      names[i] !== "" && !taken.includes(names[i]) ? [i] : [],
    );
  };
  const cells = columns.map((c) => c.filter((cell) => cell.trim() !== ""));
  const dates = columns.map((c) => dateLayouts(c));
  const numeric = cells.map(
    (c, i) => c.length > 0 && c.every(isAmountShaped) && dates[i]?.length === 0,
  );
  const filled = (i: number) => cells[i] ?? [];
  const isDate = (i: number) => (dates[i]?.length ?? 0) > 0;
  const isNumeric = (i: number) => numeric[i] === true;

  if (draft.date_column === undefined) {
    const date = free().find(isDate);
    if (date !== undefined) draft.date_column = names[date];
  }
  const dateIndex = names.indexOf(draft.date_column ?? "");
  const layouts = dates[dateIndex] ?? [];
  if (layouts.length === 1) draft.date_layout = layouts[0];

  if (draft.description_column === undefined) {
    const texts = free().filter(
      (i) => filled(i).length > 0 && !isNumeric(i) && !isDate(i),
    );
    const distinct = (i: number) =>
      new Set(filled(i).map((c) => c.trim())).size;
    const best = texts.reduce<number | undefined>(
      (top, i) => (top === undefined || distinct(i) > distinct(top) ? i : top),
      undefined,
    );
    if (best !== undefined) draft.description_column = names[best];
  }

  const hasAmount = [
    draft.amount_column,
    draft.debit_column,
    draft.credit_column,
  ];
  if (hasAmount.every((column) => column === undefined)) {
    const amounts = free().filter(isNumeric);
    if (amounts.length === 1) draft.amount_column = names[amounts[0] ?? 0];
  }
}

function setNumberForm(
  draft: ProfileDraft,
  names: string[],
  columns: string[][],
): void {
  const amount = [draft.amount_column, draft.debit_column, draft.credit_column];
  const cells = amount.flatMap((column) =>
    column === undefined ? [] : (columns[names.indexOf(column)] ?? []),
  );
  const form = numberForm(cells);
  if (form === undefined) return;

  draft.decimal_separator = form.decimal;
  const defaultGroup = form.decimal === "," ? "." : ",";
  if (form.group !== "" && form.group !== defaultGroup) {
    draft.group_separator = form.group;
  }
}
