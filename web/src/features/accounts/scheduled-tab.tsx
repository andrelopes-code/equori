import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
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
import { PhoneList } from "@/ui/phone-list";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";
import { OccurrenceActions } from "@/features/planning";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

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
  const fmt = useMoneyFormat();
  const today = useToday();
  const [days, setDays] = useState<(typeof ranges)[number]>(90);
  const projection = useQuery(
    projectionQuery(useApi(), account.id, shiftDate(today, days)),
  );
  const money = (m: components["schemas"]["Money"]) =>
    fmt.money(m, scale(m.currency));
  const points = projection.data?.points ?? [];
  const compact = useMediaQuery(compactQuery);
  const occurrenceOf = (point: (typeof points)[number]) => ({
    id: point.occurrence_id,
    schedule_id: point.schedule_id,
    expected_on: point.date,
    expected_amount: {
      amount: Math.abs(point.amount.amount),
      currency: point.amount.currency,
    },
    // A projection holds only open occurrences; an overdue one is dated today.
    state: "expected" as const,
  });
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
      {compact ? (
        <Stack gap={3}>
          <PhoneList
            label={t("scheduled.caption")}
            loading={projection.isPending}
            empty={t("scheduled.empty")}
            rows={points.map((point) => ({
              key: point.occurrence_id,
              title:
                point.date === today
                  ? t("scheduled.dueToday")
                  : formatDate(point.date, locale),
              lines: [
                <ScheduleCell key="schedule" point={point} />,
                [t("ledger.balanceAfter"), money(point.balance)].join(": "),
              ],
              end: fmt.signed(point.amount, scale(point.amount.currency)),
              actions: <OccurrenceActions occurrence={occurrenceOf(point)} />,
            }))}
          />
          {projection.data !== undefined && (
            <Text size="sm" tone="muted">
              {[
                t("scheduled.closing", {
                  date: formatDate(projection.data.to, locale),
                }),
                money(projection.data.closing),
              ].join(": ")}
            </Text>
          )}
        </Stack>
      ) : (
        <Table
          columns={5}
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
                {/* Workaround for Slotted finding "A pinned table cell has no ground, so the cells that scroll under it show through": the actions column is not pinned. */}
                <TableColumnHeader>{t("agenda.actions")}</TableColumnHeader>
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
                        {fmt.signed(point.amount, scale(point.amount.currency))}
                      </TableCell>
                      <TableCell numeric>{money(point.balance)}</TableCell>
                      <TableCell>
                        <OccurrenceActions occurrence={occurrenceOf(point)} />
                      </TableCell>
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
                      <TableCell />
                    </TableRow>
                  </TableSummary>
                )}
              </>
            )}
          </TableContent>
        </Table>
      )}
    </Stack>
  );
}
