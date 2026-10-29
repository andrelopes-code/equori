import { queryOptions } from "@tanstack/react-query";

import type { Language } from "@/i18n/languages";

export type HelpKind = "tutorial" | "howto" | "reference" | "explanation";

export interface HelpPageEntry {
  id: string;
  kind: HelpKind;
}

// The four kinds of Diátaxis, in the order the help index shows them (design, Camada 4).
export const helpKinds: readonly HelpKind[] = [
  "tutorial",
  "howto",
  "reference",
  "explanation",
];

export const helpPages: readonly HelpPageEntry[] = [
  { id: "first-month", kind: "tutorial" },
  { id: "import-statement", kind: "howto" },
  { id: "pay-statement", kind: "howto" },
  { id: "check-balance", kind: "howto" },
  { id: "category-rule", kind: "howto" },
  { id: "glossary", kind: "reference" },
  { id: "statement", kind: "reference" },
  { id: "portfolio", kind: "reference" },
  { id: "budget-plan", kind: "reference" },
  { id: "how-money-is-recorded", kind: "explanation" },
  { id: "bank-connections", kind: "explanation" },
];

// Each file is a chunk of its own, fetched when its page opens.
const files = import.meta.glob<string>("./content/**/*.md", {
  query: "?raw",
  import: "default",
});

export function isHelpPage(id: string): boolean {
  return helpPages.some((p) => p.id === id);
}

export function helpPageQuery(language: Language, region: string, id: string) {
  return queryOptions({
    queryKey: ["help", language, region, id] as const,
    queryFn: () => loadHelpPage(language, region, id),
    staleTime: Infinity,
  });
}

// The page in the reader's language, followed by the passage of the reader's region when the
// region has one (regions.md, "Help passages"). A page the language lacks is null.
export async function loadHelpPage(
  language: Language,
  region: string,
  id: string,
): Promise<string | null> {
  const basePath = `./content/${language}/${id}.md`;
  const regionalPath = `./content/regions/${region}/${language}/${id}.md`;
  const base = files[basePath];
  if (base === undefined) return null;

  const regional = files[regionalPath];
  const parts = await Promise.all([base(), regional?.()]);

  return parts
    .filter((part) => part !== undefined)
    .map((part) => part.trim())
    .join("\n\n");
}

export interface HelpText {
  title: string;
  lead: string;
  body: string;
}

// A page opens with its title as a level-one heading; the paragraph after it is the lead the
// help index shows under the title.
export function splitHelpPage(text: string): HelpText {
  const [first = "", ...rest] = text.split("\n");
  const body = rest.join("\n").trim();
  const lead = body.split(/\n\s*\n/)[0] ?? "";

  return { title: first.replace(/^#\s+/, ""), lead, body };
}
