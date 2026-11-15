import {
  Table,
  TableBody,
  TableCaption,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableGroupRow,
  TableHead,
  TableLoader,
  TableRow,
} from "@slotted/react/table";
import type { TableHandle } from "@slotted/react/table";
import { Fragment } from "react";
import type { RefObject } from "react";

import { AgendaRow } from "@/features/planning/agenda/agenda-row";
import { netOf } from "@/features/planning/model/agenda";
import type { AgendaRow as Row } from "@/features/planning/model/agenda";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

export interface AgendaGroup {
  key: string;
  // A group without a label draws no group row.
  label?: string;
  rows: readonly Row[];
}

interface AgendaTableProps {
  caption: string;
  groups: readonly AgendaGroup[];
  // What the body says when no group holds a row.
  empty?: string;
  accountNames: ReadonlyMap<string, string>;
  scale: (code: string) => number;
  loading: boolean;
  refreshing: boolean;
  handleRef: RefObject<TableHandle | null>;
}

// Occurrences in groups, each group with its net per currency at the end (spec A3).
export function AgendaTable({
  caption,
  groups,
  empty,
  accountNames,
  scale,
  loading,
  refreshing,
  handleRef,
}: AgendaTableProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  const net = (rows: readonly Row[]) => {
    const totals = netOf([...rows]);
    return totals.length === 0
      ? undefined
      : totals
          .map((total) => fmt.signed(total, scale(total.currency)))
          .join(" · ");
  };

  return (
    <Table columns={6} variant="framed" loading={refreshing}>
      <TableContent handleRef={handleRef}>
        <TableCaption>{caption}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("agenda.description")}</TableColumnHeader>
            <TableColumnHeader>{t("agenda.date")}</TableColumnHeader>
            <TableColumnHeader>{t("agenda.kindAccount")}</TableColumnHeader>
            <TableColumnHeader>{t("agenda.when")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("agenda.amount")}</TableColumnHeader>
            <TableColumnHeader sticky="end">
              {t("agenda.actions")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        {loading ? (
          <TableLoader skeletonRows={5} />
        ) : (
          <TableBody>
            {groups.length === 0 && empty !== undefined && (
              <TableEmpty>{empty}</TableEmpty>
            )}
            {groups.map((group) => (
              <Fragment key={group.key}>
                {group.label !== undefined && (
                  <TableGroupRow end={net(group.rows)}>
                    {group.label}
                  </TableGroupRow>
                )}
                {group.rows.map((row) => (
                  <AgendaRow
                    key={row.occurrence.id}
                    row={row}
                    accountName={
                      row.schedule === undefined
                        ? ""
                        : (accountNames.get(row.schedule.account_id) ?? "")
                    }
                    scale={scale}
                  />
                ))}
              </Fragment>
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
