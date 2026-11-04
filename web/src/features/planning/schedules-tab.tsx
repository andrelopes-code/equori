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
  TableColumnHeader,
  TableContent,
  TableGroupRow,
  TableHead,
  TableLoader,
  TableRow,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { occurrencesQuery, schedulesQuery } from "@/features/planning/api";
import { ScheduleRow } from "@/features/planning/schedule-row";
import { hasEnded, kindLabel } from "@/features/planning/schedule-words";
import { useScale } from "@/features/setup";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";

type ScheduleKind = components["schemas"]["ScheduleKind"];

const kinds = Object.keys(kindLabel) as ScheduleKind[];

// The schedules by kind, each with its terms in force today and its next expected occurrence.
export function SchedulesTab({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
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
  const active = items.filter((s) => !hasEnded(s.ends_on, today));
  const ended = items
    .filter((s) => hasEnded(s.ends_on, today))
    .sort((x, y) => (y.ends_on ?? "").localeCompare(x.ends_on ?? ""));
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
              const rows = active.filter((s) => s.kind === kind);
              if (rows.length === 0) return null;
              return (
                <Fragment key={kind}>
                  <TableGroupRow>{t(kindLabel[kind])}</TableGroupRow>
                  {rows.map((s) => (
                    <ScheduleRow
                      key={s.id}
                      schedule={s}
                      accountNames={names}
                      nextOn={next.get(s.id)}
                      scale={scale}
                    />
                  ))}
                </Fragment>
              );
            })}
            {ended.length > 0 && (
              <>
                <TableGroupRow>{t("schedules.ended")}</TableGroupRow>
                {ended.map((s) => (
                  <ScheduleRow
                    key={s.id}
                    schedule={s}
                    accountNames={names}
                    nextOn={next.get(s.id)}
                    scale={scale}
                    ended
                  />
                ))}
              </>
            )}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
