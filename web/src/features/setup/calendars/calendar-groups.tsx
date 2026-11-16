import { List, ListSection } from "@slotted/react/list";

import type { components } from "@/api/schema.gen";
import { CalendarOption } from "@/features/setup/calendars/calendar-option";
import { calendarRegion } from "@/features/setup/calendars/calendar-region";
import { groupByRegion } from "@/features/setup/model/region-groups";
import { useT } from "@/i18n/i18n-provider";
import { RegionLabel } from "@/ui/region/region-label";

interface CalendarGroupsProps {
  calendars: readonly components["schemas"]["Calendar"][];
  // The calendar of the book's region and the one on show.
  defaultId: string;
  chosenId: string | undefined;
}

// The calendars in one list, a section per region: the book's, the global one, then the rest. The
// calendar of the book's region leads its section.
export function CalendarGroups({
  calendars,
  defaultId,
  chosenId,
}: CalendarGroupsProps) {
  const t = useT();
  const ordered = [
    ...calendars.filter((c) => c.id === defaultId),
    ...calendars.filter((c) => c.id !== defaultId),
  ];
  const groups = groupByRegion(
    ordered,
    (c) => calendarRegion(c.id),
    calendarRegion(defaultId),
  );
  const sections = [groups.home, groups.global, ...groups.others].filter(
    (g) => g !== null,
  );

  return (
    <List variant="separated" aria-label={t("calendar.title")}>
      {sections.map((group) => (
        <ListSection
          key={group.region}
          label={<RegionLabel region={group.region} />}
        >
          {group.items.map((c) => (
            <CalendarOption
              key={c.id}
              calendar={c}
              current={c.id === chosenId}
              regional={c.id === defaultId}
            />
          ))}
        </ListSection>
      ))}
    </List>
  );
}
