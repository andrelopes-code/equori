import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
  TableSelect,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { accountsQuery } from "@/features/accounts";
import { candidateWindow, realizeCandidates } from "@/features/planning/agenda";
import type { OccurrenceRef } from "@/features/planning/agenda";
import {
  accountTransactionsQuery,
  scheduleQuery,
  useRealizeOccurrence,
} from "@/features/planning/api";
import { useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

// Realize: the reader picks the transaction among the account's ones within the schedule's grace
// days, the closest to the expected amount first; the server answers whether it may realize it.
export function RealizeDialog({
  occurrence,
  name,
  onDone,
  onCancel,
}: {
  occurrence: OccurrenceRef;
  name: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const overlayOpen = useOverlayOpen();
  const realize = useRealizeOccurrence();
  const schedule = useQuery(scheduleQuery(api, occurrence.schedule_id));
  const days =
    schedule.data === undefined
      ? undefined
      : candidateWindow(occurrence, schedule.data);
  const transactions = useQuery({
    ...accountTransactionsQuery(
      api,
      schedule.data?.account_id ?? "",
      days?.from ?? "",
      days?.to ?? "",
    ),
    enabled: days !== undefined,
  });
  const accounts = useQuery(accountsQuery(api));
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const candidates =
    schedule.data === undefined || transactions.data === undefined
      ? undefined
      : realizeCandidates(transactions.data, occurrence, schedule.data);
  const account = accounts.data?.find(
    (a) => a.id === schedule.data?.account_id,
  );
  return (
    <Dialog open={overlayOpen} size="lg" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("occurrence.realizeTitle", { name })}</DialogTitle>
          {days !== undefined && (
            <DialogDescription>
              {t("occurrence.realizeHint", {
                account: account?.name ?? "",
                from: formatDate(days.from, locale),
                to: formatDate(days.to, locale),
              })}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}
            <Table
              columns={4}
              variant="framed"
              selectionMode="single"
              value={chosen === null ? [] : [chosen]}
              onValueChange={(value) => {
                setChosen(value[0] ?? null);
              }}
            >
              <TableContent>
                <TableCaption>{t("occurrence.candidates")}</TableCaption>
                <TableHead>
                  <TableRow>
                    <TableColumnHeader>{t("scheduled.date")}</TableColumnHeader>
                    <TableColumnHeader>
                      {t("agenda.description")}
                    </TableColumnHeader>
                    <TableColumnHeader numeric>
                      {t("ledger.amount")}
                    </TableColumnHeader>
                  </TableRow>
                </TableHead>
                {candidates === undefined || scale === null ? (
                  <TableLoader skeletonRows={3} />
                ) : (
                  <TableBody>
                    {candidates.length === 0 && (
                      <TableEmpty>{t("occurrence.noCandidates")}</TableEmpty>
                    )}
                    {candidates.map((c) => (
                      <TableRow key={c.transaction.id} value={c.transaction.id}>
                        <TableSelect />
                        <TableRowHeader>
                          {formatDate(c.transaction.date, locale)}
                        </TableRowHeader>
                        <TableCell>
                          <Stack gap={1}>
                            <Text size="sm">
                              {c.transaction.description === ""
                                ? t("ledger.untitled")
                                : c.transaction.description}
                            </Text>
                            {!c.withinTolerance && (
                              <span>
                                <Tag size="sm" tone="warning">
                                  {t("occurrence.outsideTolerance")}
                                </Tag>
                              </span>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell numeric>
                          {fmt.signed(c.amount, scale(c.amount.currency))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                )}
              </TableContent>
            </Table>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            loading={realize.isPending}
            disabled={chosen === null}
            onClick={() => {
              if (chosen === null) return;
              setError(null);
              realize
                .mutateAsync({ id: occurrence.id, transactionID: chosen })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("occurrence.realize")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
