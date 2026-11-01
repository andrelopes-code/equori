import { PT_BR } from "@slotted/core/i18n/pt-BR";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";

// CLDR puts 0 in the "one" form of pt, so "{count, plural, one {# resultado} ...}" reads
// "0 resultado" (A183).
const results =
  "{count, plural, =0 {Nenhum resultado} one {# resultado} other {# resultados}}";

const slottedPt = {
  ...PT_BR,
  cascader: { ...PT_BR.cascader, results },
  combobox: { ...PT_BR.combobox, count: results },
  commandPalette: { ...PT_BR.commandPalette, count: results },
  entityPicker: { ...PT_BR.entityPicker, count: results },
  multiSelect: { ...PT_BR.multiSelect, count: results },
  select: { ...PT_BR.select, count: results },
};

export const languages = [
  { language: "en", nativeName: "English", catalog: catalogEn },
  {
    language: "pt",
    nativeName: "Português",
    catalog: catalogPtBR,
    slotted: slottedPt,
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
