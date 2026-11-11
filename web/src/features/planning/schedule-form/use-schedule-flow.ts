import { useRef } from "react";

import type { components } from "@/api/schema.gen";
import { useCreateSchedule, useEndSchedule } from "@/features/planning/api";

type ScheduleInput = components["schemas"]["ScheduleInput"];

// The schedule was created and the one it continues could not be ended.
export class EndFailedError extends Error {
  constructor(readonly reason: unknown) {
    super("the previous schedule was not ended");
  }
}

// Creates the schedule of the form and, when it continues another one (`from`), ends that one on
// the start date of the new rule. The create goes first, so a refused create leaves the source
// untouched. After a refused end the created schedule is kept: the next run ends the source only.
export function useScheduleFlow(from: string | undefined) {
  const create = useCreateSchedule();
  const end = useEndSchedule();
  const created = useRef<{ id: string; start: string } | null>(null);

  const run = async (input: ScheduleInput): Promise<string> => {
    created.current ??= {
      id: (await create.mutateAsync(input)).id,
      start: input.recurrence.start,
    };
    if (from !== undefined) {
      await end
        .mutateAsync({ id: from, from: created.current.start })
        .catch((caught: unknown) => {
          throw new EndFailedError(caught);
        });
    }

    return created.current.id;
  };

  return { run, isPending: create.isPending || end.isPending };
}
