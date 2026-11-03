import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { connectionSyncsQuery } from "@/features/accounts/api";
import { formatInstant } from "@/features/accounts/instant";
import { SyncBatchRow } from "@/features/accounts/sync-batch-row";
import { SyncRecordsTable } from "@/features/accounts/sync-records-table";
import { syncRows } from "@/features/accounts/sync-rows";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Connection = components["schemas"]["Connection"];

interface ConnectionSyncsProps {
  connection: Connection;
  accounts: Map<string, Account>;
}

// The last syncs of a connection: one table of what each changed, then the lines a sync listed,
// with the undo of its decisions.
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
    <Collapsible variant="framed" mount="active">
      <CollapsibleHeader>
        <CollapsibleTrigger
          description={t("links.syncLast", {
            time: formatInstant(runs[0]?.started_at ?? "", locale),
          })}
        >
          {t("links.syncs")}
        </CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        <Stack gap={4}>
          <Table columns={3} variant="ruled">
            <TableContent aria-label={t("links.syncs")}>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>{t("links.syncWhen")}</TableColumnHeader>
                  <TableColumnHeader>
                    {t("balanceSheet.account")}
                  </TableColumnHeader>
                  <TableColumnHeader>
                    {t("links.syncOutcome")}
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.flatMap((run) =>
                  syncRows(run).map((row) => (
                    <SyncBatchRow key={row.key} row={row} accounts={accounts} />
                  )),
                )}
              </TableBody>
            </TableContent>
          </Table>

          {runs
            .filter((run) => run.records.length > 0)
            .map((run) => {
              const time = formatInstant(run.started_at, locale);

              return (
                <SyncRecordsTable
                  key={run.sync_id}
                  records={run.records}
                  label={t("links.syncRecords", { time })}
                />
              );
            })}
        </Stack>
      </CollapsiblePanel>
    </Collapsible>
  );
}
