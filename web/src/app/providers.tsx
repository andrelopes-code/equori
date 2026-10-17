import { QueryClientProvider } from "@tanstack/react-query";
import { SlottedProvider } from "@slotted/react/i18n";
import { PT_BR } from "@slotted/core/i18n/pt-BR";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ApiProvider } from "@/api/api-context";
import { newClient } from "@/api/client";
import { newQueryClient } from "@/api/query-client";
import { I18nProvider, useAppLocale } from "@/i18n/i18n-provider";
import { readLocale } from "@/i18n/locale";
import { TodayProvider } from "@/i18n/today";

interface SessionExpiry {
  trigger: () => void;
  install: (handler: () => void) => () => void;
}

// The router is built outside AppProviders, so AppRouterProvider installs the 401 handler here.
const SessionExpiryContext = createContext<SessionExpiry | null>(null);

export function useSessionExpiry(): SessionExpiry {
  const expiry = useContext(SessionExpiryContext);
  if (expiry === null) {
    throw new Error("useSessionExpiry requires AppProviders");
  }
  return expiry;
}

function newSessionExpiry(): SessionExpiry {
  let handler: (() => void) | null = null;
  return {
    trigger: () => {
      handler?.();
    },
    install: (next) => {
      handler = next;
      return () => {
        handler = null;
      };
    },
  };
}

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
  retryDelay,
  children,
}: {
  retryDelay?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
  today?: string | undefined;
  children: ReactNode;
}) {
  const [client] = useState(() => newClient(location.origin, fetchImpl));
  const [expiry] = useState(newSessionExpiry);
  const [queryClient] = useState(() =>
    newQueryClient(expiry.trigger, retryDelay),
  );
  const [locale] = useState(readLocale);
  return (
    <TodayProvider {...(today === undefined ? {} : { today })}>
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={client}>
          <SessionExpiryContext value={expiry}>
            <I18nProvider locale={locale}>
              <SlottedLocale>{children}</SlottedLocale>
            </I18nProvider>
          </SessionExpiryContext>
        </ApiProvider>
      </QueryClientProvider>
    </TodayProvider>
  );
}
