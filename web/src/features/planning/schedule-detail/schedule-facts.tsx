import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";

import type { components } from "@/api/schema.gen";
import { calendarLabel } from "@/features/planning/model/calendar-label";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { AppLink } from "@/ui/navigation/app-link";

type Schedule = components["schemas"]["Schedule"];

interface ScheduleFactsProps {
  schedule: Schedule;
  names: Map<string, string>;
}

// The accounts, the end, the calendar and the matching values of a schedule.
export function ScheduleFacts({ schedule: s, names }: ScheduleFactsProps) {
  const t = useT();
  const [locale] = useAppLocale();

  return (
    <DescriptionList
      layout="stack"
      variant="framed"
      columns={3}
      aria-label={t("schedule.facts")}
    >
      <DescriptionListItem>
        <DescriptionListTerm>{t("schedule.account")}</DescriptionListTerm>
        <DescriptionListDescription>
          {names.get(s.account_id)}
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("schedules.counterpart")}</DescriptionListTerm>
        <DescriptionListDescription>
          {names.get(s.counterpart_id)}
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("schedules.ends")}</DescriptionListTerm>
        <DescriptionListDescription>
          {s.ends_on === undefined
            ? t("schedule.noEnd")
            : formatDate(s.ends_on, locale)}
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("schedule.calendar")}</DescriptionListTerm>
        <DescriptionListDescription>
          <AppLink
            to={{
              to: "/settings",
              search: { section: "calendars", calendar: s.calendar },
            }}
          >
            {calendarLabel(t, s.calendar)}
          </AppLink>
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("schedule.tolerance")}</DescriptionListTerm>
        <DescriptionListDescription>
          {numberFormatter(locale, {
            maximumFractionDigits: 2,
          }).format(s.match_tolerance_bp / 100)}
        </DescriptionListDescription>
      </DescriptionListItem>
      <DescriptionListItem>
        <DescriptionListTerm>{t("schedule.grace")}</DescriptionListTerm>
        <DescriptionListDescription>
          {t("schedule.days", { count: s.grace_days })}
        </DescriptionListDescription>
      </DescriptionListItem>
    </DescriptionList>
  );
}
