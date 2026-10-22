import { isLanguage, matchLanguage } from "@/i18n/languages";
import type { Language } from "@/i18n/languages";

export interface Locale {
  language: Language;
  region: string;
}

const STORAGE_KEY = "equori.locale";

export function tagOf(locale: Locale): string {
  return `${locale.language}-${locale.region}`;
}

function parseLocale(raw: string | null): Locale | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { language, region } = value as Record<string, unknown>;
    if (typeof language !== "string" || !isLanguage(language)) return null;
    if (typeof region !== "string" || region === "") return null;
    return { language, region };
  } catch {
    return null;
  }
}

export function readLocale(): Locale {
  try {
    const stored = parseLocale(localStorage.getItem(STORAGE_KEY));
    if (stored !== null) return stored;
  } catch {
    // Storage is unavailable; the browser language decides.
  }
  return {
    language: matchLanguage(navigator.languages),
    region: navigator.language.split("-")[1] ?? "US",
  };
}

export function writeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locale));
  } catch {
    // The locale still applies to this page load when storage is unavailable.
  }
  document.documentElement.lang = tagOf(locale);
}
