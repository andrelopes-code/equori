import { FieldDefaultsProvider } from "@slotted/react/field";
import { SlottedProvider } from "@slotted/react/i18n";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useAppLocaleState } from "@/i18n/i18n-provider";
import { languages } from "@/i18n/languages";

export function SlottedLocale({ children }: { children: ReactNode }) {
  const { tag, language } = useAppLocaleState();
  useEffect(() => {
    document.documentElement.lang = tag;
  }, [tag]);
  const entry = languages.find((l) => l.language === language);
  const slotted =
    entry !== undefined && "slotted" in entry ? entry.slotted : null;
  const catalogs =
    slotted === null ? {} : { [language]: slotted, [tag]: slotted };
  return (
    <SlottedProvider locale={tag} catalogs={catalogs}>
      {/* F7: required fields carry no mark; an optional field says "(optional)". */}
      <FieldDefaultsProvider necessity="optional">
        {children}
      </FieldDefaultsProvider>
    </SlottedProvider>
  );
}
