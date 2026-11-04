import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { calendarLabel } from "@/features/planning/calendar-label";
import { calendarsQuery } from "@/features/planning/api";
import { MatchingFields } from "@/features/planning/matching-fields";
import type { ScheduleDraft } from "@/features/planning/schedule-draft";
import { useT } from "@/i18n/i18n-provider";
import { AppLink } from "@/ui/app-link";
import { ChoiceSelect } from "@/ui/choice-select";

interface ScheduleAdvancedSectionProps {
  draft: ScheduleDraft;
  patch: (change: Partial<ScheduleDraft>) => void;
}

// The calendar, the match tolerance and the grace days, folded away by default.
export function ScheduleAdvancedSection({
  draft,
  patch,
}: ScheduleAdvancedSectionProps) {
  const t = useT();
  const api = useApi();
  const calendars = useQuery(calendarsQuery(api));
  const defaultCalendar = calendars.data?.default;
  const calendar = draft.calendar ?? defaultCalendar ?? "";

  return (
    <Collapsible>
      <CollapsibleHeader>
        <CollapsibleTrigger>{t("schedule.advanced")}</CollapsibleTrigger>
      </CollapsibleHeader>
      <CollapsiblePanel>
        <Stack gap={8}>
          <Field>
            <FieldLabel>{t("schedule.calendar")}</FieldLabel>
            <ChoiceSelect
              label={t("schedule.calendar")}
              multiple={false}
              value={calendar}
              choices={(calendars.data?.items ?? []).map((c) => ({
                value: c.id,
                label:
                  c.id === defaultCalendar
                    ? t("calendar.regionDefault", {
                        name: calendarLabel(t, c.id),
                      })
                    : calendarLabel(t, c.id),
              }))}
              onChange={(next) => {
                if (typeof next === "string") patch({ calendar: next });
              }}
            />
            {calendar !== "" && (
              <FieldDescription>
                <AppLink
                  to={{
                    to: "/settings",
                    search: { section: "calendars", calendar },
                  }}
                >
                  {t("calendar.open")}
                </AppLink>
              </FieldDescription>
            )}
          </Field>

          <MatchingFields values={draft} patch={patch} />
        </Stack>
      </CollapsiblePanel>
    </Collapsible>
  );
}
