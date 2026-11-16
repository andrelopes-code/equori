import { Glyph, Icon } from "@slotted/react/icon";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Inline } from "@slotted/react/inline";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useSearch } from "@tanstack/react-router";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { calendarLabel } from "@/features/planning";
import styles from "@/features/setup/calendars/calendar-option.module.css";
import { weekendNames } from "@/features/setup/calendars/weekend-days";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface CalendarOptionProps {
  calendar: components["schemas"]["Calendar"];
  // The calendar whose holidays are on show.
  current: boolean;
  // The calendar of the book's region.
  regional: boolean;
}

// One calendar of the list: its name, its weekend days, and the marks of the region's calendar and
// of the one on show. Choosing it puts it in the page's search.
export function CalendarOption({
  calendar,
  current,
  regional,
}: CalendarOptionProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const search = useSearch({ from: "/_authed/settings" });
  const weekend = useMemo(() => weekendNames(tag), [tag]);

  return (
    <ListItem current={current}>
      <ListItemLink
        render={routeTo({
          to: "/settings",
          search: { ...search, calendar: calendar.id },
          replace: true,
        })}
      >
        <ListItemBody>
          <ListItemLabel>{calendarLabel(t, calendar.id)}</ListItemLabel>
          <ListItemDescription>
            {t("calendar.weekendDays", { days: weekend(calendar.weekend) })}
          </ListItemDescription>
        </ListItemBody>

        {(regional || current) && (
          <ListItemEnd>
            {regional && (
              <Tag size="sm" tone="accent" className={styles.wide}>
                {t("calendar.regionMark")}
              </Tag>
            )}
            {current && (
              <Inline gap={3} align="center">
                <Icon>
                  <Glyph name="check" />
                </Icon>

                <Text
                  size="sm"
                  weight="medium"
                  tone="accent"
                  className={styles.wide}
                >
                  {t("calendar.showing")}
                </Text>
              </Inline>
            )}
          </ListItemEnd>
        )}
      </ListItemLink>
    </ListItem>
  );
}
