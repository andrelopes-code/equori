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
  holidayName,
  holidaysQuery,
} from "@/features/planning";
import { CalendarDay } from "@/features/setup/calendars/calendar-day";
import { CalendarGroups } from "@/features/setup/calendars/calendar-groups";
import { CalendarShiftExample } from "@/features/setup/calendars/calendar-shift-example";
import { SettingsGroup } from "@/features/setup/settings-layout/settings-group";
import { maxYear, minYear } from "@/features/setup/model/settings-search";
import { SettingsSection } from "@/features/setup/settings-layout/settings-section";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/feedback/query-error";
import { StepGlyph } from "@/ui/navigation/step-glyph";

type Holiday = components["schemas"]["Holiday"];

export function SettingsCalendars() {
  const t = useT();
  const api = useApi();
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
    const short = new Intl.DateTimeFormat(tag, { weekday: "short", ...utc });
    const number = new Intl.DateTimeFormat(tag, { day: "numeric", ...utc });
    const month = new Intl.DateTimeFormat(tag, { month: "long", ...utc });
    const date = new Intl.DateTimeFormat(tag, { dateStyle: "full", ...utc });
    return {
      month: (iso: string) => {
        const name = month.format(new Date(`${iso.slice(0, 7)}-01`));
        return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
      },
      date: (iso: string) => date.format(new Date(iso)),
      tile: (iso: string) => ({
        weekday: short.format(new Date(iso)),
        day: number.format(new Date(iso)),
      }),
    };
  }, [tag]);

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
          <CalendarGroups
            calendars={calendars.data.items}
            defaultId={calendars.data.default}
            chosenId={chosen?.id}
          />
        )}
      </SettingsGroup>

      {chosen !== undefined && (
        <SettingsGroup
          title={t("calendar.holidays.title", { year: String(year) })}
          description={calendarLabel(t, chosen.id)}
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
              <Text size="md" tone="muted">
                <output aria-live="polite">
                  {months.length === 0
                    ? t("calendar.holidays.empty", { year: String(year) })
                    : t("calendar.holidays.count", {
                        count: String(holidays.data.length),
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
                              <div className="mr-2">
                                <CalendarDay {...fmt.tile(h.date)} />
                              </div>
                            </ListItemStart>
                            <ListItemBody>
                              <ListItemLabel>{holidayName(t, h)}</ListItemLabel>
                              <ListItemDescription>
                                {fmt.date(h.date)}
                              </ListItemDescription>
                            </ListItemBody>
                            {h.source === "instance" && (
                              <ListItemEnd>
                                <Tag size="md">
                                  {t("calendar.source.instance")}
                                </Tag>
                              </ListItemEnd>
                            )}
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
    </SettingsSection>
  );
}
