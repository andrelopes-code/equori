import type { SpreadsheetSummary } from "@/features/spreadsheets/api";

// The documents whose name holds the query, in the order received. The comparison ignores case
// and accents, as a reader who types "orcamento" expects to find "Orçamento".
export function filterDocuments(
  documents: readonly SpreadsheetSummary[],
  query: string,
  locale: string,
): SpreadsheetSummary[] {
  const needle = fold(query.trim(), locale);
  if (needle === "") return [...documents];

  return documents.filter((d) => fold(d.name, locale).includes(needle));
}

function fold(text: string, locale: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase(locale);
}
