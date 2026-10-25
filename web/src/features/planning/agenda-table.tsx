import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableGroupRow,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import type { TableHandle } from "@slotted/react/table";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { Fragment } from "react";
import type { RefObject } from "react";

import { netOf } from "@/features/planning/agenda";
import type { Agenda, AgendaRow } from "@/features/planning/agenda";
import { OccurrenceActions } from "@/features/planning/occurrence-actions";
import { kindLabel, stateTone } from "@/features/planning/schedule-words";
import { formatDate, formatDayHeader } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The month's occurrences: the overdue group, then one group per day with its net at the end.
export function AgendaTable({
  caption,
  view,
  accountNames,
  scale,
  loading,
  refreshing,
  handleRef,
}: {
  caption: string;
  view: Agenda;
  accountNames: ReadonlyMap<string, string>;
  scale: (code: string) => number;
  loading: boolean;
  refreshing: boolean;
  handleRef: RefObject<TableHandle | null>;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();
  const group = (label: string, rows: AgendaRow[]) => {
    const total = netOf(rows);
    return (
      <TableGroupRow
        end={
          total === undefined
            ? undefined
            : fmt.signed(total, scale(total.currency))
        }
      >
        {label}
      </TableGroupRow>
    );
  };
  const row = (r: AgendaRow) => {
    const name =
      r.schedule === undefined || r.schedule.description === ""
        ? t("ledger.untitled")
        : r.schedule.description;
    return (
      <TableRow key={r.occurrence.id} value={r.occurrence.id}>
        <TableRowHeader text="truncate">{name}</TableRowHeader>
        <TableCell>
          <Stack gap={0}>
            <Text size="sm">
              {formatDate(r.occurrence.expected_on, locale)}
            </Text>
            {r.occurrence.moved_from !== undefined && (
              <Text size="xs" tone="muted">
                {t("agenda.movedFrom", {
                  date: formatDate(r.occurrence.moved_from, locale),
                })}
              </Text>
            )}
          </Stack>
        </TableCell>
        <TableCell>
          {r.schedule !== undefined && t(kindLabel[r.schedule.kind])}
        </TableCell>
        <TableCell text="truncate">
          {r.schedule === undefined
            ? ""
            : (accountNames.get(r.schedule.account_id) ?? "")}
        </TableCell>
        <TableCell>
          <Tag size="sm" tone={stateTone[r.occurrence.state]}>
            {t(`occurrence.state.${r.occurrence.state}`)}
          </Tag>
        </TableCell>
        <TableCell numeric>
          {fmt.signed(r.money, scale(r.money.currency))}
        </TableCell>
        <TableCell>
          <OccurrenceActions occurrence={r.occurrence} name={name} />
        </TableCell>
      </TableRow>
    );
  };
  const empty = view.overdue.length === 0 && view.days.length === 0;
  return (
    <Table columns={7} variant="framed" loading={refreshing}>
      <TableContent handleRef={handleRef}>
        <TableCaption>{caption}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("agenda.description")}</TableColumnHeader>
            <TableColumnHeader>{t("scheduled.date")}</TableColumnHeader>
            <TableColumnHeader>{t("agenda.kind")}</TableColumnHeader>
            <TableColumnHeader>{t("agenda.account")}</TableColumnHeader>
            <TableColumnHeader>{t("agenda.state")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("agenda.amount")}</TableColumnHeader>
            {/* Workaround for Slotted finding "A pinned table cell has no ground, so the cells that scroll under it show through": the actions column is not pinned. */}
            <TableColumnHeader>{t("agenda.actions")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        {loading ? (
          <TableLoader skeletonRows={6} />
        ) : (
          <TableBody>
            {empty && <TableEmpty>{t("agenda.empty")}</TableEmpty>}
            {view.overdue.length > 0 && (
              <>
                {group(t("agenda.overdue"), view.overdue)}
                {view.overdue.map(row)}
              </>
            )}
            {view.days.map((day) => (
              <Fragment key={day.date}>
                {group(
                  formatDayHeader(day.date, today, locale, {
                    today: t("day.today"),
                    yesterday: t("day.yesterday"),
                  }),
                  day.rows,
                )}
                {day.rows.map(row)}
              </Fragment>
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
