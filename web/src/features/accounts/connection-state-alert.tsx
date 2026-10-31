import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";

type Connection = components["schemas"]["Connection"];

interface ConnectionStateAlertProps {
  connection: Connection;
}

export function ConnectionStateAlert({
  connection,
}: ConnectionStateAlertProps) {
  const t = useT();

  if (connection.state !== "needs_owner") {
    return null;
  }

  return (
    <Alert tone="warning">
      <AlertContent>
        <AlertDescription>{t("links.needsOwner")}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
