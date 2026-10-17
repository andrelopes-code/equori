import { SlottedProvider } from "@slotted/react/i18n";
import { PT_BR } from "@slotted/core/i18n/pt-BR";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useAppLocale } from "@/i18n/i18n-provider";

export function SlottedLocale({ children }: { children: ReactNode }) {
  const [locale] = useAppLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <SlottedProvider locale={locale} catalogs={{ "pt-BR": PT_BR }}>
      {children}
    </SlottedProvider>
  );
}
