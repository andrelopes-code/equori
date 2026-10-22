import { PT_BR } from "@slotted/core/i18n/pt-BR";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";

export const languages = [
  { language: "en", nativeName: "English", catalog: catalogEn },
  {
    language: "pt",
    nativeName: "Português",
    catalog: catalogPtBR,
    slotted: PT_BR,
  },
] as const;

export type Language = (typeof languages)[number]["language"];

export function isLanguage(value: string): value is Language {
  return languages.some((l) => l.language === value);
}

// Matches by primary subtag, in the order of the tags; "en" when none matches.
export function matchLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const primary = (tag.split("-")[0] ?? "").toLowerCase();
    if (isLanguage(primary)) return primary;
  }
  return "en";
}
