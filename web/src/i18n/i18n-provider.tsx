import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { catalogEn } from "@/i18n/catalog.en";
import type { Catalog, MessageKey } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import type { Locale } from "@/i18n/locale";

const catalogs: Record<Locale, Catalog> = {
  en: catalogEn,
  "pt-BR": catalogPtBR,
};

type Vars = Record<string, string | number>;

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18n>({
  locale: "en",
  setLocale: () => undefined,
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
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useT(): (key: MessageKey, vars?: Vars) => string {
  const { locale } = useContext(I18nContext);
  return useCallback(
    (key, vars) => {
      const template = catalogs[locale][key];
      if (vars === undefined) return template;
      return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
        const value = vars[name];
        return value === undefined ? whole : String(value);
      });
    },
    [locale],
  );
}

export function useAppLocale(): [Locale, (locale: Locale) => void] {
  const { locale, setLocale } = useContext(I18nContext);
  return [locale, setLocale];
}
