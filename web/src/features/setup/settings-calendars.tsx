import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { List, ListEmpty, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  calendarLabel,
  calendarsQuery,
  holidaysQuery,
} from "@/features/planning";
import { maxYear, minYear } from "@/features/setup/settings-search";
import { SettingsSection } from "@/features/setup/settings-section";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";

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
  const [tag] = useAppLocale();
  const today = useToday();
  const search = useSearch({ from: "/_authed/settings" });
  const navigate = useNavigate();
  const calendars = useQuery(calendarsQuery(api));
  const year = search.year ?? Number(today.slice(0, 4));
  const chosen = calendars.data?.items.find((c) => c.id === search.calendar);
  const holidays = useQuery({
    ...holidaysQuery(api, chosen?.id ?? "", year),
    enabled: chosen !== undefined,
  });

  const fmt = useMemo(() => {
    const day = new Intl.DateTimeFormat(tag, {
      weekday: "long",
      timeZone: "UTC",
    });
    const month = new Intl.DateTimeFormat(tag, {
      month: "long",
      timeZone: "UTC",
    });
    const date = new Intl.DateTimeFormat(tag, {
      dateStyle: "full",
      timeZone: "UTC",
    });
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
      search: { ...search, year: to },
      replace: true,
    });
  };

  return (
    <SettingsSection
      topic="calendars"
      title={t("calendar.title")}
      description={t("calendar.description")}
    >
      {calendars.isPending ? (
        <SkeletonText lines={4} />
      ) : calendars.isError ? (
        <QueryError
          error={calendars.error}
          onRetry={() => void calendars.refetch()}
        />
      ) : (
        <Stack gap={6}>
          <List aria-label={t("calendar.title")}>
            {ordered.map((c) => (
              <ListItem key={c.id}>
                <ListItemContent>
                  <ListItemBody>
                    <ListItemLabel>
                      <Link
                        to="/settings"
                        search={{ calendar: c.id, year: search.year }}
                        replace
                        aria-current={c.id === chosen?.id ? "true" : undefined}
                      >
                        {calendarLabel(t, c.id)}
                      </Link>
                    </ListItemLabel>
                    <ListItemDescription>
                      {t("calendar.weekendDays", {
                        days: fmt.weekend(c.weekend),
                      })}
                    </ListItemDescription>
                  </ListItemBody>
                  {c.id === calendars.data.default && (
                    <ListItemEnd>
                      <Tag size="sm">{t("calendar.regionMark")}</Tag>
                    </ListItemEnd>
                  )}
                </ListItemContent>
              </ListItem>
            ))}
          </List>
          {chosen === undefined ? (
            <p>{t("calendar.pick")}</p>
          ) : (
            <Stack gap={4}>
              <Inline gap={3} align="center">
                <Button
                  size="sm"
                  variant="ghost"
                  tone="secondary"
                  disabled={year <= minYear}
                  onClick={() => {
                    stepYear(year - 1);
                  }}
                >
                  {t("calendar.year.previous")}
                </Button>
                <output aria-live="polite">
                  {t("calendar.holidaysOf", {
                    name: calendarLabel(t, chosen.id),
                    year: String(year),
                  })}
                </output>
                <Button
                  size="sm"
                  variant="ghost"
                  tone="secondary"
                  disabled={year >= maxYear}
                  onClick={() => {
                    stepYear(year + 1);
                  }}
                >
                  {t("calendar.year.next")}
                </Button>
              </Inline>
              {holidays.isPending ? (
                <SkeletonText lines={4} />
              ) : holidays.isError ? (
                <QueryError
                  error={holidays.error}
                  onRetry={() => void holidays.refetch()}
                />
              ) : months.length === 0 ? (
                <List aria-label={holidaysLabel}>
                  <ListEmpty>
                    {t("calendar.holidays.empty", { year: String(year) })}
                  </ListEmpty>
                </List>
              ) : (
                <List aria-label={holidaysLabel}>
                  {months.map((m) => (
                    <ListSection key={m.key} label={fmt.month(m.key)}>
                      {m.items.map((h) => (
                        <ListItem key={`${h.date}/${h.name}`}>
                          <ListItemContent>
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
            </Stack>
          )}
        </Stack>
      )}
    </SettingsSection>
  );
}
