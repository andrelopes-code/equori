import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableGroupRow,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { occurrencesQuery, schedulesQuery } from "@/features/planning/api";
import {
  currentTerms,
  kindLabel,
  recurrenceWords,
  subscriptionCost,
} from "@/features/planning/schedule-words";
import { SchedulesList } from "@/features/planning/schedules-list";
import { useScale } from "@/features/setup";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/query-error";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

type ScheduleKind = components["schemas"]["ScheduleKind"];

const kinds = Object.keys(kindLabel) as ScheduleKind[];

// The schedules by kind, each with its terms in force today and its next expected occurrence.
export function SchedulesTab({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const compact = useMediaQuery(compactQuery);
  const schedules = useQuery(schedulesQuery(api));
  const accounts = useQuery(accountsQuery(api));
  // listOccurrences reads at most 366 days.
  const upcoming = useQuery(
    occurrencesQuery(api, today, shiftDate(today, 365), { state: "expected" }),
  );
  const names = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  const next = new Map<string, string>();
  for (const o of upcoming.data ?? [])
    if (o.state === "expected" && !next.has(o.schedule_id))
      next.set(o.schedule_id, o.expected_on);
  const items = schedules.data ?? [];
  if (schedules.isError)
    return (
      <QueryError
        error={schedules.error}
        onRetry={() => void schedules.refetch()}
      />
    );
  if (!schedules.isPending && items.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("schedules.empty")}</ResultStateTitle>
          <ResultStateDescription>
            {t("schedules.emptyHint")}
          </ResultStateDescription>
        </ResultStateContent>
        <ResultStateActions>
          <Button onClick={onCreate}>{t("planning.new")}</Button>
        </ResultStateActions>
      </ResultState>
    );
  if (compact)
    return (
      <SchedulesList
        items={items}
        names={names}
        next={next}
        scale={scale}
        loading={schedules.isPending}
      />
    );
  return (
    <Table
      columns={8}
      variant="framed"
      loading={schedules.isFetching && !schedules.isPending}
    >
      <TableContent>
        <TableCaption>{t("schedules.caption")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("agenda.description")}</TableColumnHeader>
            <TableColumnHeader>{t("agenda.account")}</TableColumnHeader>
            <TableColumnHeader>{t("schedules.counterpart")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("ledger.amount")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("schedules.yearly")}
            </TableColumnHeader>
            <TableColumnHeader>{t("schedules.recurrence")}</TableColumnHeader>
            <TableColumnHeader>{t("schedules.next")}</TableColumnHeader>
            <TableColumnHeader>{t("schedules.ends")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        {schedules.isPending || scale === null ? (
          <TableLoader skeletonRows={4} />
        ) : (
          <TableBody>
            {kinds.map((kind) => {
              const rows = items.filter((s) => s.kind === kind);
              if (rows.length === 0) return null;
              return (
                <Fragment key={kind}>
                  <TableGroupRow>{t(kindLabel[kind])}</TableGroupRow>
                  {rows.map((s) => {
                    const terms = currentTerms(s.terms, today);
                    const upcomingOn = next.get(s.id);
                    return (
                      <TableRow key={s.id} value={s.id}>
                        <TableRowHeader text="truncate">
                          <Link
                            to="/planning/schedules/$id"
                            params={{ id: s.id }}
                          >
                            {s.description === ""
                              ? t("ledger.untitled")
                              : s.description}
                          </Link>
                        </TableRowHeader>
                        <TableCell text="truncate">
                          {names.get(s.account_id)}
                        </TableCell>
                        <TableCell text="truncate">
                          {names.get(s.counterpart_id)}
                        </TableCell>
                        <TableCell numeric>
                          {terms !== undefined &&
                            fmt.money(
                              terms.amount,
                              scale(terms.amount.currency),
                            )}
                        </TableCell>
                        <TableCell numeric>
                          {terms !== undefined &&
                            kind !== "transfer" &&
                            fmt.money(
                              {
                                amount: subscriptionCost(
                                  terms.recurrence,
                                  terms.amount.amount,
                                ).yearly,
                                currency: terms.amount.currency,
                              },
                              scale(terms.amount.currency),
                            )}
                        </TableCell>
                        <TableCell>
                          {terms !== undefined &&
                            recurrenceWords(terms.recurrence, t, locale)}
                        </TableCell>
                        <TableCell>
                          {upcomingOn === undefined
                            ? t("schedules.none")
                            : formatDate(upcomingOn, locale)}
                        </TableCell>
                        <TableCell>
                          {s.ends_on === undefined
                            ? t("schedule.noEnd")
                            : formatDate(s.ends_on, locale)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              );
            })}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
