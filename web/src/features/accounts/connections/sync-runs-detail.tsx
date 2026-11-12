import {
  Table,
  TableBody,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { formatInstant } from "@/features/accounts/model/instant";
import { SyncBatchRow } from "@/features/accounts/connections/sync-batch-row";
import { SyncRecordsTable } from "@/features/accounts/connections/sync-records-table";
import { syncRows } from "@/features/accounts/connections/sync-rows";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DetailSection } from "@/ui/dialogs/detail-section";

import styles from "@/features/accounts/connections/sync-runs-detail.module.css";

type Account = components["schemas"]["Account"];
type SyncRun = components["schemas"]["SyncRun"];

interface SyncRunsDetailProps {
  runs: SyncRun[];
  accounts: Map<string, Account>;
}

// L6: the runs on one side, the lines of the selected run and the undo of its decisions on the
// other. The newest run is selected first; a run that changed several accounts has one row each.
export function SyncRunsDetail({ runs, accounts }: SyncRunsDetailProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const [selectedKey, setSelectedKey] = useState(
    () => runs[0] && syncRows(runs[0])[0]?.key,
  );

  const selected =
    runs.find((run) => syncRows(run).some((row) => row.key === selectedKey)) ??
    runs[0];

  function handleValueChange(keys: readonly string[]) {
    setSelectedKey(keys[0] ?? selectedKey);
  }

  return (
    <div className={styles.split}>
      <div className={styles.runs}>
        <DetailSection title={t("links.syncs.runs")}>
          <Table
            columns={4}
            variant="ruled"
            selectionMode="single"
            value={selectedKey === undefined ? [] : [selectedKey]}
            onValueChange={handleValueChange}
          >
            <TableContent aria-label={t("links.syncs")}>
              <TableHead>
                <TableRow>
                  <TableColumnHeader />
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
                    <SyncBatchRow
                      key={row.key}
                      row={row}
                      accounts={accounts}
                      onSelect={setSelectedKey}
                    />
                  )),
                )}
              </TableBody>
            </TableContent>
          </Table>
        </DetailSection>
      </div>

      {selected !== undefined && selected.records.length > 0 && (
        <div className={styles.records}>
          <SyncRecordsTable
            key={selected.sync_id}
            records={selected.records}
            label={t("links.syncRecords", {
              time: formatInstant(selected.started_at, locale),
            })}
          />
        </div>
      )}
    </div>
  );
}
