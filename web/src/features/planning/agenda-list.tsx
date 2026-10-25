import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Fragment } from "react";

import { netOf } from "@/features/planning/agenda";
import type { Agenda, AgendaRow } from "@/features/planning/agenda";
import { OccurrenceActions } from "@/features/planning/occurrence-actions";
import { PhoneGroup } from "@/ui/phone-group";
import { kindLabel, stateTone } from "@/features/planning/schedule-words";
import { formatDate, formatDayHeader } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

// Below 600 px the month's occurrences are rows grouped by day (mobile.md M1, record work):
// name, then date, kind and account, with the amount and the actions at the end.
export function AgendaList({
  view,
  accountNames,
  scale,
  loading,
}: {
  view: Agenda;
  accountNames: ReadonlyMap<string, string>;
  scale: (code: string) => number;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();
  if (loading)
    return (
      <Stack gap={2} aria-busy="true">
        <Skeleton shape="block" blockSize="4rem" />
        <Skeleton shape="block" blockSize="4rem" />
        <Skeleton shape="block" blockSize="4rem" />
      </Stack>
    );
  if (view.overdue.length === 0 && view.days.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("agenda.empty")}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );
  const group = (key: string, label: string, rows: AgendaRow[]) => {
    const total = netOf(rows);
    return (
      <PhoneGroup
        key={key}
        label={label}
        end={
          total === undefined
            ? undefined
            : fmt.signed(total, scale(total.currency))
        }
      >
        <List aria-label={label} variant="framed">
          {rows.map((r) => {
            const name =
              r.schedule === undefined || r.schedule.description === ""
                ? t("ledger.untitled")
                : r.schedule.description;
            const details = [
              formatDate(r.occurrence.expected_on, locale),
              r.schedule === undefined ? "" : t(kindLabel[r.schedule.kind]),
              r.schedule === undefined
                ? ""
                : (accountNames.get(r.schedule.account_id) ?? ""),
            ].filter((part) => part !== "");
            return (
              <ListItem key={r.occurrence.id}>
                <ListItemContent>
                  <ListItemBody>
                    <ListItemLabel>{name}</ListItemLabel>
                    <ListItemDescription>
                      {details.join(" · ")}
                    </ListItemDescription>
                    {r.occurrence.moved_from !== undefined && (
                      <ListItemDescription>
                        {t("agenda.movedFrom", {
                          date: formatDate(r.occurrence.moved_from, locale),
                        })}
                      </ListItemDescription>
                    )}
                  </ListItemBody>
                  <ListItemEnd>
                    <Stack gap={1}>
                      <span>
                        {fmt.signed(r.money, scale(r.money.currency))}
                      </span>
                      <Tag size="sm" tone={stateTone[r.occurrence.state]}>
                        {t(`occurrence.state.${r.occurrence.state}`)}
                      </Tag>
                    </Stack>
                  </ListItemEnd>
                </ListItemContent>
                <ListItemActions>
                  <OccurrenceActions occurrence={r.occurrence} name={name} />
                </ListItemActions>
              </ListItem>
            );
          })}
        </List>
      </PhoneGroup>
    );
  };
  return (
    <Stack gap={5}>
      {view.overdue.length > 0 &&
        group("overdue", t("agenda.overdue"), view.overdue)}
      {view.days.map((day) => (
        <Fragment key={day.date}>
          {group(
            day.date,
            formatDayHeader(day.date, today, locale, {
              today: t("day.today"),
              yesterday: t("day.yesterday"),
            }),
            day.rows,
          )}
        </Fragment>
      ))}
    </Stack>
  );
}
