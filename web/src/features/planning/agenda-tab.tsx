import { parseISODate, toISODate, toISOYearMonth } from "@slotted/core/date";
import type { PlainDate } from "@slotted/core/date";
import { Calendar } from "@slotted/react/calendar";
import { Stack } from "@slotted/react/stack";
import type { TableHandle } from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { agenda, monthEnd, monthTotals } from "@/features/planning/agenda";
import type { AgendaFilter } from "@/features/planning/agenda";
import { AgendaList } from "@/features/planning/agenda-list";
import { AgendaTable } from "@/features/planning/agenda-table";
import styles from "@/features/planning/agenda.module.css";
import { occurrencesQuery, schedulesQuery } from "@/features/planning/api";
import { kindLabel } from "@/features/planning/schedule-words";
import { settingsQuery, useScale } from "@/features/setup";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceSelect } from "@/ui/choice-select";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { compactQuery, useMediaQuery, wideQuery } from "@/ui/use-media-query";

type OccurrenceState = components["schemas"]["OccurrenceState"];
type ScheduleKind = components["schemas"]["ScheduleKind"];

const states: readonly OccurrenceState[] = [
  "expected",
  "overdue",
  "realized",
  "skipped",
];
const kinds = Object.keys(kindLabel) as ScheduleKind[];
const any = "";

// The month's occurrences, the overdue ones of the last year above them, and what the month is
// planned to bring in and take out.
export function AgendaTab({
  month,
  onMonth,
}: {
  month: string;
  onMonth: (month: string) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const wide = useMediaQuery(wideQuery);
  const compact = useMediaQuery(compactQuery);
  const from = `${month}-01`;
  const occurrences = useQuery(occurrencesQuery(api, from, monthEnd(month)));
  // listOccurrences reads at most 366 days.
  const overdue = useQuery(
    occurrencesQuery(api, shiftDate(today, -365), today, { state: "overdue" }),
  );
  const schedules = useQuery(schedulesQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const [filter, setFilter] = useState<AgendaFilter>({});
  const shownFilter = useDeferredValue(filter);
  const [focused, setFocused] = useState<PlainDate | null>(() =>
    parseISODate(from),
  );
  const [shownMonth, setShownMonth] = useState(month);
  const [day, setDay] = useState<PlainDate | null>(null);
  const table = useRef<TableHandle>(null);
  // The month control moves the calendar's month too.
  if (shownMonth !== month) {
    setShownMonth(month);
    setFocused(parseISODate(from));
  }

  const view = agenda(
    occurrences.data ?? [],
    overdue.data ?? [],
    schedules.data ?? [],
    shownFilter,
  );
  const currency = settings.data?.base_currency;
  const totals =
    currency === undefined ? undefined : monthTotals(view, month, currency);
  const accountNames = new Map(
    (accounts.data ?? []).map((a) => [a.id, a.name]),
  );
  const scheduleAccounts = new Set(
    (schedules.data ?? []).map((s) => s.account_id),
  );
  const loading =
    occurrences.isPending ||
    overdue.isPending ||
    schedules.isPending ||
    scale === null;
  const chosen = (value: string | string[] | null) =>
    typeof value === "string" && value !== any ? value : undefined;
  const anyChoice = { value: any, label: t("agenda.any") };
  const figures = (
    <FigureGrid label={t("agenda.figures")}>
      <FigureCard
        label={t("agenda.inflow")}
        value={
          totals === undefined || scale === null
            ? undefined
            : {
                money: totals.inflow,
                scale: scale(totals.inflow.currency),
              }
        }
        note={t("agenda.inflowNote")}
        loading={loading || totals === undefined}
      />
      <FigureCard
        label={t("agenda.outflow")}
        value={
          totals === undefined || scale === null
            ? undefined
            : {
                money: totals.outflow,
                scale: scale(totals.outflow.currency),
              }
        }
        note={t("agenda.outflowNote")}
        loading={loading || totals === undefined}
      />
    </FigureGrid>
  );
  return (
    <Stack gap={6}>
      <div
        className={styles.filters}
        aria-label={t("agenda.filters")}
        role="group"
      >
        <ChoiceSelect
          label={t("agenda.state")}
          multiple={false}
          placeholder={t("agenda.state")}
          value={filter.state ?? null}
          choices={[
            anyChoice,
            ...states.map((s) => ({
              value: s,
              label: t(`occurrence.state.${s}`),
            })),
          ]}
          onChange={(value) => {
            setFilter((prev) => ({
              ...prev,
              state: chosen(value) as OccurrenceState | undefined,
            }));
          }}
        />
        <ChoiceSelect
          label={t("agenda.schedule")}
          multiple={false}
          placeholder={t("agenda.schedule")}
          value={filter.scheduleID ?? null}
          choices={[
            anyChoice,
            ...(schedules.data ?? []).map((s) => ({
              value: s.id,
              label:
                s.description === "" ? t("ledger.untitled") : s.description,
            })),
          ]}
          onChange={(value) => {
            setFilter((prev) => ({ ...prev, scheduleID: chosen(value) }));
          }}
        />
        <ChoiceSelect
          label={t("agenda.account")}
          multiple={false}
          placeholder={t("agenda.account")}
          value={filter.accountID ?? null}
          choices={[
            anyChoice,
            ...(accounts.data ?? [])
              .filter((a) => scheduleAccounts.has(a.id))
              .map((a) => ({ value: a.id, label: a.name })),
          ]}
          onChange={(value) => {
            setFilter((prev) => ({ ...prev, accountID: chosen(value) }));
          }}
        />
        <ChoiceSelect
          label={t("agenda.kind")}
          multiple={false}
          placeholder={t("agenda.kind")}
          value={filter.kind ?? null}
          choices={[
            anyChoice,
            ...kinds.map((k) => ({ value: k, label: t(kindLabel[k]) })),
          ]}
          onChange={(value) => {
            setFilter((prev) => ({
              ...prev,
              kind: chosen(value) as ScheduleKind | undefined,
            }));
          }}
        />
      </div>
      {!compact && figures}
      <div className={styles.layout}>
        <div
          className={styles.list}
          aria-busy={shownFilter !== filter || undefined}
        >
          {compact ? (
            <AgendaList
              view={view}
              accountNames={accountNames}
              scale={scale ?? (() => 0)}
              loading={loading}
            />
          ) : (
            <AgendaTable
              caption={t("agenda.caption")}
              view={view}
              accountNames={accountNames}
              scale={scale ?? (() => 0)}
              loading={loading}
              refreshing={occurrences.isFetching && !occurrences.isPending}
              handleRef={table}
            />
          )}
        </div>
        {wide && (
          <Calendar
            aria-label={t("agenda.calendar")}
            locale={locale}
            {...(focused === null ? {} : { focusedDate: focused })}
            onFocusedDateChange={(date) => {
              setFocused(date);
              const next = toISOYearMonth(date);
              if (next !== month) onMonth(next);
            }}
            value={day}
            onValueChange={(next) => {
              if (next === null || Array.isArray(next) || !("year" in next))
                return;
              setDay(next);
              const iso = toISODate(next);
              const first = view.days.find((d) => d.date === iso)?.rows[0];
              if (first !== undefined)
                table.current?.scrollToRow(first.occurrence.id);
            }}
          />
        )}
      </div>
      {compact && figures}
    </Stack>
  );
}
