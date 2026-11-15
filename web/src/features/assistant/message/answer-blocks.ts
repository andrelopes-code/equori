import type { MarkdownNode } from "@slotted/core/markdown";

export type AnswerSegment =
  | { kind: "markdown"; tree: MarkdownNode }
  | { kind: "compare"; head: [string, string]; rows: BlockRow[] }
  | {
      kind: "ranking";
      head: [string, string];
      rows: BlockRow[];
      numbered: boolean;
    }
  | { kind: "series"; head: [string, string]; rows: SeriesRow[] };

export interface BlockRow {
  label: string;
  text: string;
  value: number;
}

// day: days since the first row.
export interface SeriesRow extends BlockRow {
  day: number;
}

interface Day {
  year?: number;
  month: number;
  day: number;
}

type BlockSegment = Exclude<AnswerSegment, { kind: "markdown" }>;

const msPerDay = 86_400_000;

// A year-less first row counts as 2000: only differences between rows matter and the clock is
// never read.
const fallbackYear = 2000;

const minus = "[−-]";

// A marker is a currency symbol or a code: letters and symbols with no digit and no space.
const markerSource = "[\\p{Sc}\\p{L}]+";

// Splits the root's children at each table that becomes a block; consecutive other nodes form
// one markdown segment (a root node holding them).
export function answerSegments(
  tree: MarkdownNode,
  locale: string,
): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let pending: MarkdownNode[] = [];

  for (const child of tree.children ?? []) {
    const block =
      child.type === "table" ? tableBlock(child, locale) : undefined;
    if (block === undefined) {
      pending.push(child);
      continue;
    }

    if (pending.length > 0) segments.push(markdownSegment(tree, pending));
    pending = [];
    segments.push(block);
  }

  if (pending.length > 0 || segments.length === 0) {
    segments.push(markdownSegment(tree, pending));
  }

  return segments;
}

// The number a cell writes, or undefined: the cell holds one run of digits with the locale's
// group and decimal separators, an optional minus sign (U+2212 or "-") and a marker (currency
// symbol or code) before or after; value = the digits read with the locale's decimal separator.
export function parseAmount(
  text: string,
  locale: string,
): { value: number; marker: string } | undefined {
  const { group, decimal } = separators(locale);
  const g = escapeRegExp(group);
  const d = escapeRegExp(decimal);
  const grouped = group === "" ? "" : `\\d{1,3}(?:${g}\\d{3})+|`;
  const pattern = new RegExp(
    `^(${minus})?(${markerSource})? ?(${minus})? ?(${grouped}\\d+)(?:${d}(\\d+))? ?(${markerSource})?$`,
    "u",
  );
  const match = pattern.exec(text.trim().replace(/[\s\u202f]/gu, " "));
  if (match === null) return undefined;

  const [, signBefore, markerBefore, signAfter, whole, fraction, markerAfter] =
    match;
  if (markerBefore !== undefined && markerAfter !== undefined) return undefined;
  if (signBefore !== undefined && signAfter !== undefined) return undefined;

  const digits = (whole ?? "").split(group).join("");
  const magnitude = Number(`${digits}.${fraction ?? "0"}`);
  const negative = signBefore !== undefined || signAfter !== undefined;

  return {
    value: negative && magnitude !== 0 ? -magnitude : magnitude,
    marker: markerBefore ?? markerAfter ?? "",
  };
}

// A day and month, with an optional year, in the locale's order (Intl formatToParts of a date),
// or ISO YYYY-MM-DD; undefined otherwise.
export function parseDay(text: string, locale: string): Day | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(text.trim());
  if (iso !== null) {
    return validDay({
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    });
  }

  const match = /^(\d{1,2})\D(\d{1,2})(?:\D(\d{4}))?$/u.exec(text.trim());
  if (match === null) return undefined;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const [day, month] = dayComesFirst(locale)
    ? [first, second]
    : [second, first];

  return validDay(
    match[3] === undefined
      ? { month, day }
      : { year: Number(match[3]), month, day },
  );
}

function tableBlock(
  table: MarkdownNode,
  locale: string,
): BlockSegment | undefined {
  const [headRow, ...bodyRows] = table.children ?? [];
  if (headRow === undefined || bodyRows.length < 2) return undefined;

  const grid = [headRow, ...bodyRows].map((row) =>
    (row.children ?? []).map(textOf),
  );
  if (grid.some((cells) => cells.length !== 2)) return undefined;

  const [head = [], ...body] = grid;
  const header: [string, string] = [head[0] ?? "", head[1] ?? ""];
  const rows = amountRows(body, locale);
  if (rows === undefined) return undefined;

  if (rows.length === 2) return { kind: "compare", head: header, rows };

  const series = seriesRows(body, rows, locale);
  if (series !== undefined)
    return { kind: "series", head: header, rows: series };

  if (rows.some((row) => row.value < 0)) return undefined;

  return {
    kind: "ranking",
    head: header,
    rows,
    numbered: rows.every(
      (row, i) => i === 0 || row.value <= (rows[i - 1]?.value ?? 0),
    ),
  };
}

// The rows of a table whose second column holds amounts of one marker.
function amountRows(body: string[][], locale: string): BlockRow[] | undefined {
  const rows: BlockRow[] = [];
  let marker: string | undefined;

  for (const [label = "", text = ""] of body) {
    const amount = parseAmount(text, locale);
    if (amount === undefined) return undefined;
    if (marker !== undefined && marker !== amount.marker) return undefined;

    marker = amount.marker;
    rows.push({ label, text, value: amount.value });
  }

  return rows;
}

function seriesRows(
  body: string[][],
  rows: BlockRow[],
  locale: string,
): SeriesRow[] | undefined {
  const series: SeriesRow[] = [];
  let year = fallbackYear;
  let first = 0;
  let previous = Number.NEGATIVE_INFINITY;

  for (const [i, row] of rows.entries()) {
    const parsed = parseDay(body[i]?.[0] ?? "", locale);
    if (parsed === undefined) return undefined;

    year = parsed.year ?? year;
    const time = Date.UTC(year, parsed.month - 1, parsed.day);
    if (time <= previous) return undefined;

    if (i === 0) first = time;
    previous = time;
    series.push({ ...row, day: Math.round((time - first) / msPerDay) });
  }

  return series;
}

function markdownSegment(
  root: MarkdownNode,
  children: MarkdownNode[],
): AnswerSegment {
  return { kind: "markdown", tree: { ...root, children } };
}

function validDay(day: Day): Day | undefined {
  const year = day.year ?? fallbackYear;
  const date = new Date(Date.UTC(year, day.month - 1, day.day));
  const real =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === day.month - 1 &&
    date.getUTCDate() === day.day;

  return real ? day : undefined;
}

function dayComesFirst(locale: string): boolean {
  const types = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
    .formatToParts(new Date(Date.UTC(2000, 10, 22)))
    .map((part) => part.type);

  return types.indexOf("day") < types.indexOf("month");
}

function separators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
  const group = parts.find((part) => part.type === "group")?.value ?? "";
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";

  return { group: /^\s$/u.test(group) ? " " : group, decimal };
}

function textOf(node: MarkdownNode): string {
  return (node.value ?? "") + (node.children ?? []).map(textOf).join("");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
