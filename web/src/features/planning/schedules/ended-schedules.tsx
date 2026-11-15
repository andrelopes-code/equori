import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";

import type { components } from "@/api/schema.gen";
import { ScheduleTable } from "@/features/planning/schedules/schedule-table";
import { useT } from "@/i18n/i18n-provider";

type Schedule = components["schemas"]["Schedule"];

interface EndedSchedulesProps {
  schedules: readonly Schedule[];
  accountNames: ReadonlyMap<string, string>;
  scale: (code: string) => number;
}

// The schedules that ended, closed under the active ones (spec B4, P4).
export function EndedSchedules({
  schedules,
  accountNames,
  scale,
}: EndedSchedulesProps) {
  const t = useT();
  if (schedules.length === 0) return null;

  return (
    <Collapsible variant="framed" mount="active">
      <CollapsibleHeader>
        <CollapsibleTrigger>
          {t("schedules.endedCount", { count: String(schedules.length) })}
        </CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        <ScheduleTable
          caption={t("schedules.ended")}
          groups={[{ key: "ended", schedules }]}
          accountNames={accountNames}
          nextOn={new Map()}
          scale={scale}
          ended
        />
      </CollapsiblePanel>
    </Collapsible>
  );
}
