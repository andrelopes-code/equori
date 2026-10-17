import { QueryClientProvider } from "@tanstack/react-query";
import { SlottedProvider } from "@slotted/react/i18n";
import { PT_BR } from "@slotted/core/i18n/pt-BR";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ApiProvider } from "@/api/api-context";
import { newClient } from "@/api/client";
import { newQueryClient } from "@/api/query-client";
import { I18nProvider, useAppLocale } from "@/i18n/i18n-provider";
import { readLocale } from "@/i18n/locale";
import { TodayProvider } from "@/i18n/today";

function SlottedLocale({ children }: { children: ReactNode }) {
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

export function AppProviders({
  fetchImpl,
  today,
  children,
}: {
  fetchImpl?: typeof fetch | undefined;
  today?: string | undefined;
  children: ReactNode;
}) {
  const [client] = useState(() => newClient(location.origin, fetchImpl));
  const [queryClient] = useState(() => newQueryClient(() => undefined));
  const [locale] = useState(readLocale);
  return (
    <TodayProvider {...(today === undefined ? {} : { today })}>
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={client}>
          <I18nProvider locale={locale}>
            <SlottedLocale>{children}</SlottedLocale>
          </I18nProvider>
        </ApiProvider>
      </QueryClientProvider>
    </TodayProvider>
  );
}
