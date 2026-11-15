import { Stack } from "@slotted/react/stack";
import type { TableHandle } from "@slotted/react/table";
import { useDeferredValue, useRef, useState } from "react";

import { AgendaFilters } from "@/features/planning/agenda/agenda-filters";
import { AgendaSummary } from "@/features/planning/agenda/agenda-summary";
import { AgendaTable } from "@/features/planning/agenda/agenda-table";
import styles from "@/features/planning/agenda/agenda.module.css";
import { DaysSection } from "@/features/planning/agenda/days-section";
import { DoneSection } from "@/features/planning/agenda/done-section";
import { pendingSections } from "@/features/planning/agenda/pending-sections";
import { RunningBalance } from "@/features/planning/agenda/running-balance";
import { useAgendaMonth } from "@/features/planning/agenda/use-agenda-month";
import type { AgendaFilter } from "@/features/planning/model/agenda";
import { formatDayMonth, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

interface AgendaTabProps {
  month: string;
  onMonth: (month: string) => void;
}

// The month's close, what is still to pay and receive, the days money moves and the running
// balance (docs/specs/2026-11-15-planning-tabs-design.md, section 4).
export function AgendaTab({ month, onMonth }: AgendaTabProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const [filter, setFilter] = useState<AgendaFilter>({});
  const shownFilter = useDeferredValue(filter);
  const data = useAgendaMonth(month, shownFilter);
  const [doneOpen, setDoneOpen] = useState<boolean | null>(null);
  const pendingTable = useRef<TableHandle>(null);
  const doneTable = useRef<TableHandle>(null);

  const groups = pendingSections(data.groups, {
    overdue: t("agenda.overdue"),
    week: t("agenda.until", {
      date: formatDayMonth(shiftDate(today, 7), locale),
    }),
    later: t("agenda.rest"),
  });
  const accountNames = new Map(data.accounts.map((a) => [a.id, a.name]));
  const scale = data.scale ?? (() => 0);
  const open = doneOpen ?? (!data.loading && groups.length === 0);

  function handleDay(iso: string) {
    const pending = groups
      .flatMap((g) => g.rows)
      .find((r) => r.occurrence.expected_on === iso);
    if (pending !== undefined) {
      pendingTable.current?.scrollToRow(pending.occurrence.id);
      return;
    }

    const done = data.groups.done.find((r) => r.occurrence.expected_on === iso);
    if (done === undefined) return;

    setDoneOpen(true);
    requestAnimationFrame(() =>
      doneTable.current?.scrollToRow(done.occurrence.id),
    );
  }

  return (
    <Stack gap={6}>
      <AgendaSummary
        month={month}
        close={data.close}
        scale={data.scale}
        loading={data.loading}
      />

      <div className={styles.columns}>
        <div
          className={styles.column}
          aria-busy={shownFilter !== filter || undefined}
        >
          <AgendaFilters
            filter={filter}
            schedules={data.schedules}
            accounts={data.accounts}
            onChange={setFilter}
          />

          <AgendaTable
            caption={t("agenda.caption")}
            groups={groups}
            empty={
              data.rows.length === 0
                ? t("agenda.empty")
                : t("agenda.nothingPending")
            }
            accountNames={accountNames}
            scale={scale}
            loading={data.loading}
            refreshing={data.refreshing}
            handleRef={pendingTable}
          />

          <DoneSection
            rows={data.groups.done}
            open={open}
            onOpenChange={setDoneOpen}
            accountNames={accountNames}
            scale={scale}
            handleRef={doneTable}
          />
        </div>

        <DaysSection
          month={month}
          marks={data.marks}
          onMonth={onMonth}
          onDay={handleDay}
        />
      </div>

      {data.currency !== undefined && data.scale !== null && (
        <RunningBalance
          series={data.series}
          currency={data.currency}
          scale={data.scale(data.currency)}
          label={t("agenda.running")}
        />
      )}
    </Stack>
  );
}
