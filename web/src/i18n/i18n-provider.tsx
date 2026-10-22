import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import type { MessageKey } from "@/i18n/catalog.en";
import { languages } from "@/i18n/languages";
import type { Language } from "@/i18n/languages";
import { tagOf, writeLocale } from "@/i18n/locale";
import type { Locale } from "@/i18n/locale";

type Vars = Record<string, string | number>;

export type TFunction = (key: MessageKey, vars?: Vars) => string;

interface I18n {
  locale: Locale;
  tag: string;
  language: Language;
  setLocale: (locale: Locale) => void;
  setLanguage: (language: Language) => void;
}

const fallback: Locale = { language: "en", region: "US" };

const I18nContext = createContext<I18n>({
  locale: fallback,
  tag: tagOf(fallback),
  language: fallback.language,
  setLocale: () => undefined,
  setLanguage: () => undefined,
});

export function I18nProvider({
  locale: initial,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  const setLocale = useCallback((next: Locale) => {
    writeLocale(next);
    setLocaleState(next);
  }, []);
  const setLanguage = useCallback(
    (language: Language) => {
      setLocale({ ...locale, language });
    },
    [locale, setLocale],
  );
  const value = useMemo(
    () => ({
      locale,
      tag: tagOf(locale),
      language: locale.language,
      setLocale,
      setLanguage,
    }),
    [locale, setLocale, setLanguage],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useT(): TFunction {
  const { language } = useContext(I18nContext);
  return useCallback(
    (key, vars) => {
      const template = (
        languages.find((l) => l.language === language) ?? languages[0]
      ).catalog[key];
      if (vars === undefined) return template;
      return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
        const value = vars[name];
        return value === undefined ? whole : String(value);
      });
    },
    [language],
  );
}

export function useAppLocaleState(): I18n {
  return useContext(I18nContext);
}

// The tag of the locale, for Intl, and the setter of the language.
export function useAppLocale(): [string, (language: Language) => void] {
  const { tag, setLanguage } = useContext(I18nContext);
  return [tag, setLanguage];
}
