import { Button, IconButton } from "@slotted/react/button";
import { ButtonGroup } from "@slotted/react/button-group";
import { Icon } from "@slotted/react/icon";
import { List, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
  ListItemStart,
  ListItemContent,
} from "@slotted/react/list-item";
import { SkeletonText } from "@slotted/react/skeleton";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  calendarLabel,
  calendarsQuery,
  holidaysQuery,
} from "@/features/planning";
import { CalendarDay } from "@/features/setup/calendar-day";
import { CalendarShiftExample } from "@/features/setup/calendar-shift-example";
import { SettingsGroup } from "@/features/setup/settings-group";
import { maxYear, minYear } from "@/features/setup/settings-search";
import { SettingsSection } from "@/features/setup/settings-section";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";
import { StepGlyph } from "@/ui/step-glyph";
import { useAppLink } from "@/ui/use-app-link";

type Holiday = components["schemas"]["Holiday"];

// The API names the days in this order; the reference dates below start on a Sunday.
const weekdayOrder = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const sunday = Date.UTC(2023, 0, 1);
const dayMs = 86_400_000;

export function SettingsCalendars() {
  const t = useT();
  const api = useApi();
  const follow = useAppLink();
  const [tag] = useAppLocale();
  const today = useToday();
  const search = useSearch({ from: "/_authed/settings" });
  const navigate = useNavigate();
  const calendars = useQuery(calendarsQuery(api));
  const year = search.year ?? Number(today.slice(0, 4));
  // The region's calendar is on show until the reader picks another.
  const chosenID = search.calendar ?? calendars.data?.default;
  const chosen = calendars.data?.items.find((c) => c.id === chosenID);
  const holidays = useQuery({
    ...holidaysQuery(api, chosen?.id ?? "", year),
    enabled: chosen !== undefined,
  });

  const fmt = useMemo(() => {
    const utc = { timeZone: "UTC" } as const;
    const day = new Intl.DateTimeFormat(tag, { weekday: "long", ...utc });
    const short = new Intl.DateTimeFormat(tag, { weekday: "short", ...utc });
    const number = new Intl.DateTimeFormat(tag, { day: "numeric", ...utc });
    const month = new Intl.DateTimeFormat(tag, { month: "long", ...utc });
    const date = new Intl.DateTimeFormat(tag, { dateStyle: "full", ...utc });
    const list = new Intl.ListFormat(tag, { type: "conjunction" });
    return {
      weekend: (days: readonly string[]) =>
        list.format(
          days.map((d) =>
            day.format(new Date(sunday + weekdayOrder.indexOf(d) * dayMs)),
          ),
        ),
      month: (iso: string) => month.format(new Date(`${iso.slice(0, 7)}-01`)),
      date: (iso: string) => date.format(new Date(iso)),
      tile: (iso: string) => ({
        weekday: short.format(new Date(iso)),
        day: number.format(new Date(iso)),
      }),
    };
  }, [tag]);

  const ordered = useMemo(() => {
    const items = calendars.data?.items ?? [];
    const first = items.filter((c) => c.id === calendars.data?.default);
    return [...first, ...items.filter((c) => c.id !== calendars.data?.default)];
  }, [calendars.data]);

  const months = useMemo(() => {
    const out: { key: string; items: Holiday[] }[] = [];
    for (const h of holidays.data ?? []) {
      const key = h.date.slice(0, 7);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(h);
      else out.push({ key, items: [h] });
    }
    return out;
  }, [holidays.data]);

  const holidaysLabel =
    chosen === undefined
      ? ""
      : t("calendar.holidaysOf", {
          name: calendarLabel(t, chosen.id),
          year: String(year),
        });

  const stepYear = (to: number) => {
    void navigate({
      to: "/settings",
      search: { ...search, calendar: chosen?.id, year: to },
      replace: true,
    });
  };

  return (
    <SettingsSection
      topic="calendars"
      title={t("calendar.title")}
      description={t("calendar.purpose")}
    >
      <SettingsGroup
        title={t("calendar.how.title")}
        description={t("calendar.how.description")}
      >
        <CalendarShiftExample
          weekday={(iso) => fmt.tile(iso).weekday}
          day={(iso) => fmt.tile(iso).day}
          date={fmt.date}
        />
      </SettingsGroup>

      <SettingsGroup
        title={t("calendar.list.title")}
        description={t("calendar.list.description")}
      >
        {calendars.isPending ? (
          <SkeletonText lines={4} />
        ) : calendars.isError ? (
          <QueryError
            error={calendars.error}
            onRetry={() => void calendars.refetch()}
          />
        ) : (
          <List variant="separated" aria-label={t("calendar.title")}>
            {ordered.map((c) => (
              <ListItem
                key={c.id}
                current={c.id === chosen?.id}
                selected={c.id === chosen?.id}
                tone="accent"
              >
                <ListItemLink
                  href={`/settings?section=calendars&calendar=${c.id}`}
                  onClick={follow({
                    to: "/settings",
                    search: { ...search, calendar: c.id },
                    replace: true,
                  })}
                >
                  <ListItemBody>
                    <ListItemLabel>{calendarLabel(t, c.id)}</ListItemLabel>
                    <ListItemDescription>
                      {t("calendar.weekendDays", {
                        days: fmt.weekend(c.weekend),
                      })}
                    </ListItemDescription>
                  </ListItemBody>
                  {c.id === calendars.data.default && (
                    <ListItemEnd>
                      <Tag size="sm" tone="accent">
                        {t("calendar.regionMark")}
                      </Tag>
                    </ListItemEnd>
                  )}
                </ListItemLink>
              </ListItem>
            ))}
          </List>
        )}
      </SettingsGroup>

      {chosen !== undefined && (
        <SettingsGroup
          title={holidaysLabel}
          actions={
            // CP-04: the year steps like the month and the period of the other screens.
            <ButtonGroup
              aria-label={holidaysLabel}
              variant="outline"
              tone="secondary"
            >
              <IconButton
                aria-label={t("calendar.year.previous")}
                disabled={year <= minYear}
                onClick={() => {
                  stepYear(year - 1);
                }}
              >
                <Icon>
                  <StepGlyph direction="previous" />
                </Icon>
              </IconButton>
              <Button
                onClick={() => {
                  stepYear(Number(today.slice(0, 4)));
                }}
              >
                {String(year)}
              </Button>
              <IconButton
                aria-label={t("calendar.year.next")}
                disabled={year >= maxYear}
                onClick={() => {
                  stepYear(year + 1);
                }}
              >
                <Icon>
                  <StepGlyph direction="next" />
                </Icon>
              </IconButton>
            </ButtonGroup>
          }
        >
          {holidays.isPending ? (
            <SkeletonText lines={4} />
          ) : holidays.isError ? (
            <QueryError
              error={holidays.error}
              onRetry={() => void holidays.refetch()}
            />
          ) : (
            <>
              <Text size="sm" tone="muted">
                <output aria-live="polite">
                  {months.length === 0
                    ? t("calendar.holidays.empty", { year: String(year) })
                    : t("calendar.holidays.count", {
                        count: String(holidays.data.length),
                        year: String(year),
                      })}
                </output>
              </Text>
              {months.length > 0 && (
                <List aria-label={holidaysLabel}>
                  {months.map((m) => (
                    <ListSection key={m.key} label={fmt.month(m.key)}>
                      {m.items.map((h) => (
                        <ListItem key={`${h.date}/${h.name}`}>
                          <ListItemContent>
                            <ListItemStart>
                              <CalendarDay {...fmt.tile(h.date)} />
                            </ListItemStart>
                            <ListItemBody>
                              <ListItemLabel>{h.name}</ListItemLabel>
                              <ListItemDescription>
                                {fmt.date(h.date)}
                              </ListItemDescription>
                            </ListItemBody>
                            <ListItemEnd>
                              <Tag size="sm">
                                {t(
                                  h.source === "rule"
                                    ? "calendar.source.rule"
                                    : "calendar.source.instance",
                                )}
                              </Tag>
                            </ListItemEnd>
                          </ListItemContent>
                        </ListItem>
                      ))}
                    </ListSection>
                  ))}
                </List>
              )}
            </>
          )}
        </SettingsGroup>
      )}
    </SettingsSection>
  );
}
