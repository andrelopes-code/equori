import { queryOptions } from "@tanstack/react-query";

import { helpPages, loadHelpPage } from "@/features/help/model/help-pages";
import type { HelpPageEntry } from "@/features/help/model/help-pages";
import { parseHelpPage } from "@/features/help/model/parse-help-page";
import type {
  HelpBlock,
  HelpDocument,
  HelpSection,
} from "@/features/help/model/parse-help-page";
import type { Language } from "@/i18n/languages";

export interface HelpLibraryPage extends HelpPageEntry {
  document: HelpDocument;
}

export type HelpLibrary = readonly HelpLibraryPage[];

type HelpTerm = Extract<HelpBlock, { type: "term" }>;

// Every page of the reader's language, parsed: what the index lists and the search reads.
export function helpLibraryQuery(language: Language, region: string) {
  return queryOptions({
    queryKey: ["help", language, region] as const,
    queryFn: () => loadHelpLibrary(language, region),
    staleTime: Infinity,
  });
}

export async function loadHelpLibrary(
  language: Language,
  region: string,
): Promise<HelpLibrary> {
  const texts = await Promise.all(
    helpPages.map((page) => loadHelpPage(language, region, page.id)),
  );

  return helpPages.flatMap((page, index) => {
    const text = texts[index];

    return text == null ? [] : [{ ...page, document: parseHelpPage(text) }];
  });
}

// A symptom is a section of the troubleshooting page with a written id (spec HP8).
export function symptomsOf(library: HelpLibrary): HelpSection[] {
  const page = library.find((p) => p.id === "troubleshooting");

  return page?.document.sections.filter((s) => s.written) ?? [];
}

export function termsOf(library: HelpLibrary): HelpTerm[] {
  const page = library.find((p) => p.id === "glossary");

  return page?.document.intro.filter((b) => b.type === "term") ?? [];
}
