import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";

import type { components } from "@/api/schema.gen";
import { stalledHours } from "@/features/accounts/stalled-hours";
import { formatDate, todayISO } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Connection = components["schemas"]["Connection"];

interface ConnectionStateAlertProps {
  connection: Connection;
}

export function ConnectionStateAlert({
  connection,
}: ConnectionStateAlertProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const portal = connection.portal ?? t("sync.portal.none");
  const now = new Date();

  let text: string | null = null;

  if (connection.state === "needs_owner") {
    text = t("links.needsOwner");
  }

  if (connection.state === "stalled") {
    text = t("links.stalled", { hours: stalledHours(connection, now), portal });
  }

  if (
    connection.state === "consent_expiring" &&
    connection.consent_expires_at
  ) {
    const day = todayISO(new Date(connection.consent_expires_at));
    text = t("links.consentExpiring", {
      date: formatDate(day, locale),
      portal,
    });
  }

  if (text === null) {
    return null;
  }

  return (
    <Alert tone="warning">
      <AlertContent>
        <AlertDescription>{text}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
