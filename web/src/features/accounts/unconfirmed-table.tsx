import { Link } from "@slotted/react/link";
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
  TableSelectAll,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { unconfirmedQuery } from "@/features/accounts/api";
import { useUnconfirmedSelection } from "@/features/accounts/use-unconfirmed-selection";
import { UnconfirmedSelectionBar } from "@/features/accounts/unconfirmed-selection-bar";
import { BulkVoidDialog } from "@/features/transactions";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { BulkOutcomeNotice } from "@/ui/bulk-outcome-notice";
import { routeTo } from "@/ui/route-to";

interface UnconfirmedTableProps {
  accountId: string;
  scale: (code: string) => number;
}

// The transactions of the period that no line of the institution confirmed.
export function UnconfirmedTable({ accountId, scale }: UnconfirmedTableProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const unconfirmed = useQuery(unconfirmedQuery(useApi(), accountId));

  const entries = unconfirmed.data ?? [];
  const commands = useUnconfirmedSelection(entries);

  return (
    <Stack gap={3}>
      <Table
        columns={4}
        variant="framed"
        selectionMode="multiple"
        value={commands.selection}
        onValueChange={commands.setSelection}
      >
        <TableContent>
          <TableCaption>{t("reconciliation.unconfirmed")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableSelectAll />
              <TableColumnHeader>{t("reconciliation.date")}</TableColumnHeader>
              <TableColumnHeader>{t("ledger.movement")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("ledger.amount")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          {unconfirmed.isPending ? (
            <TableLoader skeletonRows={2} />
          ) : (
            <TableBody>
              {entries.length === 0 && (
                <TableEmpty>{t("reconciliation.unconfirmedEmpty")}</TableEmpty>
              )}
              {entries.map((entry) => (
                <TableRow
                  key={entry.transaction_id}
                  value={entry.transaction_id}
                >
                  <TableSelect />
                  <TableRowHeader>
                    {formatDate(entry.date, locale)}
                  </TableRowHeader>
                  <TableCell>
                    <Link
                      variant="neutral"
                      underline="hover"
                      render={routeTo({
                        to: "/transactions/$id",
                        params: { id: entry.transaction_id },
                      })}
                    >
                      {entry.description === ""
                        ? t("ledger.untitled")
                        : entry.description}
                    </Link>
                  </TableCell>
                  <TableCell numeric>
                    {fmt.money(entry.amount, scale(entry.amount.currency))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>

      <UnconfirmedSelectionBar
        count={commands.selection.length}
        onClear={commands.clear}
        onVoid={commands.startVoid}
      />

      {commands.outcome !== null && (
        <BulkOutcomeNotice
          outcome={commands.outcome}
          summary="bulk.voided"
          labelOf={commands.labelOf}
        />
      )}

      <BulkVoidDialog
        ids={commands.selectedIds}
        {...(commands.amount !== undefined && { amount: commands.amount })}
        open={commands.voiding}
        onOpenChange={commands.setVoiding}
        onDone={commands.finishVoid}
      />

      <Text size="sm" tone="muted">
        {t("reconciliation.unconfirmedNote")}
      </Text>
    </Stack>
  );
}
