import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
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
  TableSummary,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { projectionQuery } from "@/features/accounts/api";
import { ScheduleCell } from "@/features/accounts/schedule-cell";
import {
  formatDate,
  formatMoney,
  formatSigned,
  shiftDate,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

const ranges = [30, 90, 365] as const;

// A56: the balance the schedules lead to, one expected entry at a time, an overdue one dated today.
export function ScheduledTab({
  account,
  scale,
}: {
  account: Account;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const [days, setDays] = useState<(typeof ranges)[number]>(90);
  const projection = useQuery(
    projectionQuery(useApi(), account.id, shiftDate(today, days)),
  );
  const money = (m: components["schemas"]["Money"]) =>
    formatMoney(m, scale(m.currency), locale);
  const points = projection.data?.points ?? [];
  return (
    <Stack gap={3}>
      <div>
        <SegmentedControl
          size="sm"
          aria-label={t("scheduled.range")}
          value={String(days)}
          onValueChange={(value) => {
            const next = ranges.find((r) => String(r) === value);
            if (next !== undefined) setDays(next);
          }}
        >
          {ranges.map((r) => (
            <Segment key={r} value={String(r)}>
              {r === 365
                ? t("account.chart.year")
                : t("account.chart.days", { count: r })}
            </Segment>
          ))}
        </SegmentedControl>
      </div>
      <Table
        columns={4}
        variant="framed"
        loading={projection.isFetching && !projection.isPending}
      >
        <TableContent>
          <TableCaption>{t("scheduled.caption")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("scheduled.date")}</TableColumnHeader>
              <TableColumnHeader>{t("scheduled.schedule")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("ledger.amount")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("ledger.balanceAfter")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          {projection.isPending ? (
            <TableLoader skeletonRows={4} />
          ) : (
            <>
              <TableBody>
                {points.length === 0 && (
                  <TableEmpty>{t("scheduled.empty")}</TableEmpty>
                )}
                {points.map((point) => (
                  <TableRow
                    key={point.occurrence_id}
                    value={point.occurrence_id}
                  >
                    <TableRowHeader>
                      {point.date === today
                        ? t("scheduled.dueToday")
                        : formatDate(point.date, locale)}
                    </TableRowHeader>
                    <TableCell>
                      <ScheduleCell point={point} />
                    </TableCell>
                    <TableCell numeric>
                      {formatSigned(
                        point.amount,
                        scale(point.amount.currency),
                        locale,
                      )}
                    </TableCell>
                    <TableCell numeric>{money(point.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {projection.data !== undefined && (
                <TableSummary>
                  <TableRow>
                    <TableRowHeader colSpan={3}>
                      {t("scheduled.closing", {
                        date: formatDate(projection.data.to, locale),
                      })}
                    </TableRowHeader>
                    <TableCell numeric>
                      {money(projection.data.closing)}
                    </TableCell>
                  </TableRow>
                </TableSummary>
              )}
            </>
          )}
        </TableContent>
      </Table>
    </Stack>
  );
}
