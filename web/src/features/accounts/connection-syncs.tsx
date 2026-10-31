import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { connectionSyncsQuery } from "@/features/accounts/api";
import { SyncRunSummary } from "@/features/accounts/sync-run-summary";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Connection = components["schemas"]["Connection"];

interface ConnectionSyncsProps {
  connection: Connection;
  accounts: Map<string, Account>;
}

// The last syncs of a connection: what each did, line by line, with the undo of its decisions.
export function ConnectionSyncs({
  connection,
  accounts,
}: ConnectionSyncsProps) {
  const t = useT();
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

  return (
    <Stack gap={4}>
      <Text size="sm" tone="muted">
        {t("links.syncs")}
      </Text>
      {syncs.data.items.map((run) => (
        <SyncRunSummary key={run.sync_id} run={run} accounts={accounts} />
      ))}
    </Stack>
  );
}
