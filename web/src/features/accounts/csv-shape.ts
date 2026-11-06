const leadingDate = /^(\d{1,4})([/. -])(\d{1,2})\2(\d{1,4})\b/u;
const markerPattern = /\d[\s)]*(\p{L}{1,2})$/u;
const numberCore = /\d(?:[\d.,'\s]*\d)?/u;
const maxDistinct = 8;

const orders = [
  ["DD", "MM", "YYYY"],
  ["MM", "DD", "YYYY"],
  ["YYYY", "MM", "DD"],
  ["DD", "MM", "YY"],
  ["MM", "DD", "YY"],
  ["YY", "MM", "DD"],
] as const;

// Every layout that reads every non-blank cell, with the separator the cells use.
export function dateLayouts(cells: readonly string[]): string[] {
  const written = filled(cells).map((c) => leadingDate.exec(c));
  const separator = written[0]?.[2];
  if (separator === undefined) return [];
  if (written.some((m) => m?.[2] !== separator)) return [];

  return orders
    .filter((order) =>
      written.every((m) => m !== null && readsDate(order, m.slice(1))),
    )
    .map((order) => order.join(separator));
}

// The decimal separator and the group separator ("" for none) that the deciding cells agree on.
export function numberForm(
  cells: readonly string[],
): { decimal: "," | "."; group: string } | undefined {
  const forms = filled(cells).flatMap((c) => cellForm(c) ?? []);
  const decimal = forms[0]?.decimal;
  if (decimal === undefined) return undefined;

  const group = forms.find((f) => f.decimal === decimal && f.group !== "");
  return { decimal, group: group?.group ?? "" };
}

// The letters of at most two characters after the number, such as D and C.
export function markerTokens(cells: readonly string[]): string[] {
  const lines = filled(cells);
  const tokens = lines.flatMap((c) => markerPattern.exec(c)?.[1] ?? []);
  const distinct = [...new Set(tokens)];
  // Two letters after every amount are a currency (kr, zł); one letter can still be a mark.
  const currency =
    distinct.length === 1 &&
    tokens.length === lines.length &&
    (distinct[0]?.length ?? 0) === 2;

  return currency ? [] : distinct.slice(0, maxDistinct);
}

export function distinctValues(cells: readonly string[]): string[] {
  const values = [...new Set(filled(cells))];
  return values.length > maxDistinct ? [] : values;
}

function filled(cells: readonly string[]): string[] {
  return cells.map((c) => c.trim()).filter((c) => c !== "");
}

// match is [first, separator, second, third] as written; order names what each position holds.
function readsDate(order: readonly string[], match: string[]): boolean {
  const [a = "", , b = "", c = ""] = match;
  const written = [a, b, c];
  const part = (kind: string): string => written[order.indexOf(kind)] ?? "";
  const widths = order.every((kind, i) =>
    new RegExp(
      `^\\d{${kind === "YYYY" ? "4" : kind === "YY" ? "2" : "1,2"}}$`,
      "u",
    ).test(written[i] ?? ""),
  );
  if (!widths) return false;

  const yearKind = order.includes("YYYY") ? "YYYY" : "YY";
  const shortYear = part(yearKind);
  const year = shortYear.length === 2 ? `20${shortYear}` : shortYear;
  const iso = `${year}-${part("MM").padStart(2, "0")}-${part("DD").padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(iso)
  );
}

function cellForm(
  cell: string,
): { decimal: "," | "."; group: string } | undefined {
  const core = numberCore.exec(cell)?.[0];
  if (core === undefined) return undefined;
  const separators = core.replace(/\d/gu, "");

  const trailing = /([.,])\d{1,2}$/u.exec(core)?.[1];
  if (trailing === "," || trailing === ".") {
    const group = separators
      .slice(0, -1)
      .split("")
      .find((s) => s !== trailing);
    return { decimal: trailing, group: group ?? "" };
  }

  const distinct = [...new Set(separators.split(""))];
  const last = separators.slice(-1);
  if (distinct.length > 1 && (last === "," || last === ".")) {
    return { decimal: last, group: distinct.find((s) => s !== last) ?? "" };
  }
  if (distinct.length === 1 && separators.length > 1) {
    if (distinct[0] === ".") return { decimal: ",", group: "." };
    if (distinct[0] === ",") return { decimal: ".", group: "," };
  }
  return undefined;
}
