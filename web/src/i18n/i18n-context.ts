import { createContext } from "react";

import type { Language } from "@/i18n/languages";
import type { Locale } from "@/i18n/locale";

export interface I18n {
  locale: Locale;
  tag: string;
  language: Language;
  setLocale: (locale: Locale) => void;
  setLanguage: (language: Language) => void;
}

// This module imports only types from the app, so a change of a catalog never evaluates it again in
// the dev server: two contexts would leave consumers on the fallback, in English.
export const I18nContext = createContext<I18n>({
  locale: { language: "en", region: "US" },
  tag: "en-US",
  language: "en",
  setLocale: () => undefined,
  setLanguage: () => undefined,
});
