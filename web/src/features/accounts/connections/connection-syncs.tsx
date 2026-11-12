import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { connectionSyncsQuery } from "@/features/accounts/api";
import { formatInstant } from "@/features/accounts/model/instant";
import { SyncRunsDetail } from "@/features/accounts/connections/sync-runs-detail";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

type Account = components["schemas"]["Account"];
type Connection = components["schemas"]["Connection"];

interface ConnectionSyncsProps {
  connection: Connection;
  accounts: Map<string, Account>;
}

// L6: the last sync in one line and the button of the layer that holds the runs, the lines each
// listed and the undo of its decisions.
export function ConnectionSyncs({
  connection,
  accounts,
}: ConnectionSyncsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const syncs = useQuery(connectionSyncsQuery(api, connection.id));

  if (syncs.isError) {
    return (
      <Alert tone="danger">
        <AlertContent>
          <AlertDescription>{errorText(syncs.error, t)}</AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  if (syncs.data === undefined || syncs.data.items.length === 0) {
    return null;
  }

  const runs = syncs.data.items;

  return (
    <DetailDialog
      title={t("links.syncs")}
      description={t("links.syncs.layer.description")}
      summary={t("links.syncLast", {
        time: formatInstant(runs[0]?.started_at ?? "", locale),
      })}
      triggerLabel={t("links.syncs.open")}
    >
      <SyncRunsDetail runs={runs} accounts={accounts} />
    </DetailDialog>
  );
}
