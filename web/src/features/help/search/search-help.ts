import type {
  HelpLibrary,
  HelpLibraryPage,
} from "@/features/help/model/help-library";
import type { HelpKind } from "@/features/help/model/help-pages";
import { plainText } from "@/features/help/model/parse-help-page";
import type { HelpBlock } from "@/features/help/model/parse-help-page";

export type HelpHitGroup = "pages" | "sections" | "terms" | "text";

export interface HelpHit {
  group: HelpHitGroup;
  page: string;
  hash?: string;
  title: string;
  pageTitle: string;
  kind: HelpKind;
  excerpt: string;
}

export interface HelpSearchResult {
  query: string;
  best: HelpHit | null;
  groups: { group: HelpHitGroup; hits: HelpHit[] }[];
  count: number;
  // Entries that match one word, offered when no entry matches every word.
  near: HelpHit[];
}

interface Entry extends Omit<HelpHit, "excerpt"> {
  text: string;
}

const GROUPS: readonly HelpHitGroup[] = ["pages", "sections", "terms", "text"];
const WORD = /[\p{L}\p{N}]+/gu;
// A shorter word with one changed letter is another word ("pote", "pite").
const FUZZY_FROM = 5;
const NEAR_FROM = 3;
const NEAR_LIMIT = 3;

// The search of the help (spec 2026-11-17-help-design, HP9): every word of the query in one
// entry, title matches before text matches, pages before sections before terms.
export function searchHelp(
  library: HelpLibrary,
  query: string,
): HelpSearchResult {
  const words = queryWords(query);
  if (words.length === 0) {
    return { query: "", best: null, groups: [], count: 0, near: [] };
  }

  const entries = library.flatMap(entriesOf);
  const inTitle = entries.filter((e) => matchesAll(e.title, words));
  const inText = entries.filter(
    (e) => !inTitle.includes(e) && matchesAll(`${e.title} ${e.text}`, words),
  );
  const [best, ...others] = [...byGroup(inTitle), ...byGroup(inText)];
  if (best === undefined) {
    return {
      query: query.trim(),
      best: null,
      groups: [],
      count: 0,
      near: nearOf(entries, words),
    };
  }

  const listed = new Set(
    [best, ...others].filter((e) => e.group !== "text").map((e) => e.page),
  );
  const kept = others.filter((e) => e.group !== "text" || !listed.has(e.page));
  const groups = GROUPS.map((group) => ({
    group,
    hits: kept.filter((e) => e.group === group).map((e) => hitOf(e, words)),
  })).filter((g) => g.hits.length > 0);

  return {
    query: query.trim(),
    best: hitOf(best, words),
    groups,
    count: 1 + kept.length,
    near: [],
  };
}

// The words of a text that the query matches, as [start, end) ranges, for the highlight.
export function hitRanges(text: string, query: string): [number, number][] {
  const words = queryWords(query);

  return [...text.matchAll(WORD)]
    .filter((m) => words.some((w) => matchesWord(w, normalize(m[0]))))
    .map((m) => [m.index, m.index + m[0].length]);
}

function entriesOf(page: HelpLibraryPage): Entry[] {
  const { document } = page;
  const base = { page: page.id, pageTitle: document.title, kind: page.kind };
  const intro = document.intro.filter((b) => b.type !== "term");

  return [
    { ...base, group: "pages", title: document.title, text: document.lead },
    ...document.sections.map((section): Entry => ({
      ...base,
      group: "sections",
      hash: section.id,
      title: section.title,
      text: blocksText(section.blocks),
    })),
    ...document.intro.flatMap((block): Entry[] =>
      block.type === "term"
        ? [
            {
              ...base,
              group: "terms",
              hash: block.id,
              title: block.term,
              text: plainText(block.markdown),
            },
          ]
        : [],
    ),
    ...(intro.length === 0
      ? []
      : [
          {
            ...base,
            group: "text" as const,
            title: document.title,
            text: blocksText(intro),
          },
        ]),
  ];
}

function blocksText(blocks: readonly HelpBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "steps") {
        return block.steps.map((s) => plainText(s.markdown)).join(" ");
      }

      if (block.type === "figure") return block.figure.caption;

      return plainText(block.markdown.replace(/```[^\n]*/g, ""));
    })
    .join(" ");
}

function byGroup(entries: readonly Entry[]): Entry[] {
  return GROUPS.flatMap((group) => entries.filter((e) => e.group === group));
}

function hitOf(entry: Entry, words: readonly string[]): HelpHit {
  return {
    group: entry.group,
    page: entry.page,
    ...(entry.hash === undefined ? {} : { hash: entry.hash }),
    title: entry.title,
    pageTitle: entry.pageTitle,
    kind: entry.kind,
    excerpt: excerptOf(entry, words),
  };
}

// The first sentence when the title carries the match; else the sentence that holds a word.
function excerptOf(entry: Entry, words: readonly string[]): string {
  const sentences = entry.text.split(/(?<=[.!?])\s+/);
  const [first = ""] = sentences;
  if (matchesAll(entry.title, words)) return first;

  const index = sentences.findIndex(
    (s) => hitRanges(s, words.join(" ")).length > 0,
  );
  if (index <= 0) return first;

  return `… ${sentences[index] ?? ""}`;
}

function nearOf(
  entries: readonly Entry[],
  words: readonly string[],
): HelpHit[] {
  // A long word counts by its start, so "parcelado" finds "parcelas".
  const long = words
    .filter((w) => w.length >= NEAR_FROM)
    .map((w) => w.slice(0, FUZZY_FROM));
  const any = (text: string) => long.some((w) => matchesAll(text, [w]));
  const near = [
    ...byGroup(entries.filter((e) => any(e.title))),
    ...byGroup(entries.filter((e) => !any(e.title) && any(e.text))),
  ];

  return near.slice(0, NEAR_LIMIT).map((e) => hitOf(e, long));
}

function queryWords(query: string): string[] {
  return (query.match(WORD) ?? []).map(normalize);
}

function matchesAll(text: string, words: readonly string[]): boolean {
  const found = (text.match(WORD) ?? []).map(normalize);

  return words.every((w) => found.some((f) => matchesWord(w, f)));
}

// A prefix, or one changed, missing or extra letter against the word or its start.
function matchesWord(query: string, word: string): boolean {
  if (word.startsWith(query)) return true;
  if (query.length < FUZZY_FROM) return false;

  return (
    withinOneEdit(query, word) ||
    withinOneEdit(query, word.slice(0, query.length))
  );
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;

  let start = 0;
  while (start < a.length && a[start] === b[start]) start++;

  if (a.length === b.length) return a.slice(start + 1) === b.slice(start + 1);

  const [long, short] = a.length > b.length ? [a, b] : [b, a];

  return long.slice(start + 1) === short.slice(start);
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
