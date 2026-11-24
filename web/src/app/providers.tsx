import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import { ApiProvider } from "@/api/api-context";
import { newClient } from "@/api/client";
import { newQueryClient } from "@/api/query-client";
import { SessionExpiryContext, newSessionExpiry } from "@/app/session-expiry";
import { SlottedLocale } from "@/app/slotted-locale";
import { I18nProvider } from "@/i18n/i18n-provider";
import { readLocale } from "@/i18n/locale";
import { TodayProvider } from "@/i18n/today";
import { PrivacyProvider } from "@/privacy/privacy-provider";

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
              <PrivacyProvider>
                <SlottedLocale>{children}</SlottedLocale>
              </PrivacyProvider>
            </I18nProvider>
          </SessionExpiryContext>
        </ApiProvider>
      </QueryClientProvider>
    </TodayProvider>
  );
}
