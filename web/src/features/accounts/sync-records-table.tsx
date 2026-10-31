import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useUndoDecision } from "@/features/accounts/api";
import { recordOutcome } from "@/features/accounts/sync-outcome";
import { useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type ExternalRecord = components["schemas"]["ExternalRecord"];

interface SyncRecordsTableProps {
  records: ExternalRecord[];
  label: string;
}

// The lines a sync listed, each with its outcome and, for an automatic decision, its undo.
export function SyncRecordsTable({ records, label }: SyncRecordsTableProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const undo = useUndoDecision();
  const [error, setError] = useState<string | null>(null);

  async function handleUndo(id: string) {
    setError(null);

    try {
      await undo.mutateAsync(id);
    } catch (caught) {
      setError(errorText(caught, t));
    }
  }

  return (
    <Stack gap={2}>
      {error !== null && (
        <Alert tone="danger" live="assertive">
          <AlertContent>
            <AlertDescription>{error}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <Table columns={5} variant="framed">
        <TableContent>
          <TableCaption>{label}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("links.syncDate")}</TableColumnHeader>
              <TableColumnHeader>
                {t("links.syncDescription")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("links.syncAmount")}
              </TableColumnHeader>
              <TableColumnHeader>{t("links.syncOutcome")}</TableColumnHeader>
              <TableColumnHeader align="end">
                {t("links.actions")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id} value={record.id}>
                <TableRowHeader>
                  {formatDate(record.date, locale)}
                </TableRowHeader>
                <TableCell>{record.description}</TableCell>
                <TableCell numeric>
                  {fmt.signed(
                    record.amount,
                    (scale ?? (() => 2))(record.amount.currency),
                  )}
                </TableCell>
                <TableCell>{t(recordOutcome(record))}</TableCell>
                <TableCell align="end">
                  {record.decision !== undefined && (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={undo.isPending && undo.variables === record.id}
                      aria-label={t("links.undoOf", {
                        description: record.description,
                      })}
                      onClick={() => {
                        void handleUndo(record.id);
                      }}
                    >
                      {t("links.undo")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableContent>
      </Table>
    </Stack>
  );
}
