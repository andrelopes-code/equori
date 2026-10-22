import type { components } from "@/api/schema.gen";
import { splitCsv } from "@/features/accounts/csv-preview";

type CsvProfile = components["schemas"]["CsvProfile"];

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
  field: "date_column" | "description_column" | "amount_column" | "id_column";
  pattern: RegExp;
}[] = [
  { field: "date_column", pattern: /^(data|date|dt)\b/u },
  {
    field: "description_column",
    pattern: /(descri|historico|memo|lancamento|estabelecimento|title)/u,
  },
  { field: "amount_column", pattern: /^(valor|amount|value|quantia)\b/u },
  { field: "id_column", pattern: /^(id|identificador|documento|fitid)$/u },
];

// What a new account's CSV profile starts from: the delimiter of the first line, its header names
// matched by the words banks use, and the date and decimal shapes of the first line read.
export function guessProfile(text: string): ProfileDraft {
  const first = text.replace(/^\uFEFF/u, "").split(/\r?\n/u, 1)[0] ?? "";
  const [delimiter, char] = delimiterChars.reduce<
    readonly [CsvProfile["delimiter"], string]
  >(
    (best, [name, c]) =>
      first.split(c).length > first.split(best[1]).length ? [name, c] : best,
    ["comma", ","],
  );
  const rows = splitCsv(text.replace(/^\uFEFF/u, ""), char);
  const header = rows[0] ?? [];
  const sample =
    rows.find((row, i) => i > 0 && row.some((c) => c.trim() !== "")) ?? [];
  const draft: ProfileDraft = {
    delimiter,
    header_rows: 1,
    amount_sign: "as_is",
  };
  for (const { field, pattern } of columnWords) {
    const name = header.find((h) => pattern.test(plain(h)));
    if (name !== undefined) draft[field] = name.trim();
  }
  const dateIndex = header.findIndex((h) => h.trim() === draft.date_column);
  const dateCell = (sample[dateIndex] ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(dateCell)) draft.date_layout = "YYYY-MM-DD";
  else if (/^\d{2}\/\d{2}\/\d{4}$/u.test(dateCell))
    draft.date_layout = "DD/MM/YYYY";
  const amountIndex = header.findIndex((h) => h.trim() === draft.amount_column);
  const amountCell = (sample[amountIndex] ?? "").trim();
  const lastComma = amountCell.lastIndexOf(",");
  const lastDot = amountCell.lastIndexOf(".");
  if (amountCell !== "")
    draft.decimal_separator = lastComma > lastDot ? "," : ".";
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
    !amountReady
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
  } as CsvProfile;
}
