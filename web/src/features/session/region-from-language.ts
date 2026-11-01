import { regions } from "@/i18n/regions";

// The region subtag of a language tag when it is an assigned region code (A164.3).
export function regionFromLanguage(tag: string): string | null {
  try {
    const region = new Intl.Locale(tag).region;
    return region !== undefined &&
      (regions as readonly string[]).includes(region)
      ? region
      : null;
  } catch {
    return null;
  }
}
