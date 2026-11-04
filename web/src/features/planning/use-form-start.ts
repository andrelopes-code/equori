import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { occurrencesQuery, scheduleQuery } from "@/features/planning/api";
import { draftFromSchedule } from "@/features/planning/draft-from-schedule";
import {
  emptyDraft,
  type ScheduleDraft,
} from "@/features/planning/schedule-draft";
import { shiftDate } from "@/i18n/format";
import { useToday } from "@/i18n/today";

// The draft the schedule form opens with: empty, or filled from the schedule `from` names. A
// source that cannot be read opens the empty form. Null while the source is loading.
export function useFormStart(from: string | undefined): ScheduleDraft | null {
  const api = useApi();
  const today = useToday();
  const source = useQuery({
    ...scheduleQuery(api, from ?? ""),
    enabled: from !== undefined,
  });
  // listOccurrences reads at most 366 days.
  const next = useQuery({
    ...occurrencesQuery(api, today, shiftDate(today, 365), {
      state: "expected",
      ...(from === undefined ? {} : { schedule_id: from }),
    }),
    enabled: from !== undefined,
  });

  if (from === undefined || source.isError) return emptyDraft(today);
  if (source.isPending || next.isPending) return null;

  return draftFromSchedule(
    source.data,
    next.data?.[0]?.expected_on ?? null,
    today,
  );
}
