import type { LogoIndex } from "@/features/accounts/institution-logo";

export interface CatalogueEntry {
  ispb: string;
  code: string | undefined;
  // The name an institution created from the entry takes.
  name: string;
  legalName: string;
}

const legalSuffix =
  /\s*(?:S\.?\/?A\.?|LTDA\.?|EIRELI|ME|S\/A)\s*$|\s+-\s+.*$/iu;
const lowerWords = new Set(["do", "da", "de", "dos", "das", "e"]);
const vowel = /[aeiouáéíóúâêôãõà]/iu;

function titleWord(word: string, first: boolean): string {
  const lower = word.toLocaleLowerCase("pt-BR");
  if (!first && lowerWords.has(lower)) return lower;
  const bare = word.replace(/[()]/gu, "");
  // A word without a vowel is an acronym (CCTVM, XP, BTG): it keeps its capitals.
  if (!vowel.test(bare)) return word;
  return lower.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

// The catalogue holds legal names ("ITAÚ UNIBANCO S.A."); an account reads better under the
// trade part of it, without the company form and in title case when the source shouts.
export function displayName(legal: string): string {
  let name = legal.trim();
  for (let previous = ""; previous !== name;) {
    previous = name;
    name = name.replace(legalSuffix, "").trim();
  }
  if (/\p{Ll}/u.test(name)) return name;
  return name
    .split(/\s+/u)
    .map((word, i) => titleWord(word, i === 0))
    .join(" ");
}

const png = 1;

// The catalogue entries an institution can be created from: those with a logo, by name, without
// the ones the owner already has.
export function catalogueEntries(
  index: LogoIndex,
  owned: readonly { ispb?: string | undefined }[],
  locale: string,
): CatalogueEntry[] {
  const taken = new Set(
    owned.flatMap((i) => (i.ispb === undefined ? [] : [i.ispb])),
  );
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return Object.entries(index)
    .flatMap(([ispb, [code, legalName, formats]]) =>
      typeof formats === "number" &&
      (formats & png) !== 0 &&
      typeof legalName === "string" &&
      !taken.has(ispb)
        ? [
            {
              ispb,
              code: typeof code === "string" ? code : undefined,
              name: displayName(legalName),
              legalName,
            },
          ]
        : [],
    )
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function sortInstitutions(
  names: readonly string[],
  locale: string,
): string[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return [...names].sort((a, b) => collator.compare(a, b));
}
