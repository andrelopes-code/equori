export type Locale = "en" | "pt-BR";

const STORAGE_KEY = "equori.locale";

export function detectLocale(language: string): Locale {
  return language.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "pt-BR";
}

export function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage is unavailable; the browser language decides.
  }
  return detectLocale(navigator.language);
}

export function writeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // The locale still applies to this page load when storage is unavailable.
  }
  document.documentElement.lang = locale;
}
