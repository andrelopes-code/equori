import type { TFunction } from "@/i18n/i18n-provider";

interface MissingField {
  label: string;
  missing: boolean;
}

// null when every field holds a valid value; otherwise one sentence naming the fields to fill in.
export function missingSentence(
  fields: MissingField[],
  what: string,
  t: TFunction,
  tag: string,
): string | null {
  const names = fields.filter((f) => f.missing).map((f) => f.label);
  if (names.length === 0) return null;

  const list = new Intl.ListFormat(tag, {
    style: "long",
    type: "conjunction",
  });

  return t("calc.answer.missing", { fields: list.format(names), what });
}

// A label in the middle of a sentence: its first letter lowercased with the locale, unless the
// second letter is uppercase (an acronym such as "IPCA rate" stays).
export function lowerFirst(label: string, tag: string): string {
  const [first = "", second = ""] = label;
  if (second !== second.toLocaleLowerCase(tag)) return label;

  return first.toLocaleLowerCase(tag) + label.slice(1);
}
