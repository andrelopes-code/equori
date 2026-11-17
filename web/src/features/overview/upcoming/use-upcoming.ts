import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { useBase } from "@/features/overview/model/use-base";
import {
  upcomingDays,
  upcomingView,
} from "@/features/overview/upcoming/upcoming";
import { occurrencesQuery, schedulesQuery } from "@/features/planning";
import { shiftDate } from "@/i18n/format";
import { useToday } from "@/i18n/today";

// The read reaches 180 days back for overdue occurrences; the contract allows 366 days.
const lookBackDays = 180;

// The reads of the Upcoming widget and the view they give; `view` is undefined while they load.
export function useUpcoming() {
  const api = useApi();
  const today = useToday();
  const { base, scale } = useBase();
  const occurrences = useQuery(
    occurrencesQuery(
      api,
      shiftDate(today, -lookBackDays),
      shiftDate(today, upcomingDays),
    ),
  );
  const schedules = useQuery(schedulesQuery(api));

  const error = occurrences.error ?? schedules.error;
  const ready =
    occurrences.data !== undefined &&
    schedules.data !== undefined &&
    base !== undefined &&
    scale !== null &&
    error === null;
  const view = ready
    ? upcomingView(occurrences.data, schedules.data, today, base)
    : undefined;

  function retry() {
    if (occurrences.isError) void occurrences.refetch();
    if (schedules.isError) void schedules.refetch();
  }

  return { view, base, scale, error, retry };
}
