import { useQuery } from "@tanstack/react-query";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";

import { useApi } from "@/api/api-context";
import { meQuery } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";

export function ReadOnlyNotice() {
  const t = useT();
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });

  if (me?.book_role !== "read") return null;

  return (
    <Alert tone="info" reach="page">
      <AlertContent>
        <AlertDescription>{t("shell.readOnly")}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
