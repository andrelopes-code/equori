import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import type { components } from "@/api/schema.gen";
import { historyState } from "@/features/instruments/coverage-line";

type Coverage = components["schemas"]["InstrumentCoverage"];

export const historyPollMs = 5000;

// D24: the instrument refetches while a history is pending; when it stops, the prices reload.
export function historyPending(coverage: Coverage | undefined): boolean {
  return coverage !== undefined && historyState(coverage).kind !== "idle";
}

export function useHistoryRefresh(
  code: string,
  coverage: Coverage | undefined,
) {
  const client = useQueryClient();
  const pending = historyPending(coverage);
  const was = useRef(pending);

  useEffect(() => {
    if (was.current && !pending)
      void client.invalidateQueries({
        queryKey: ["instruments", "prices", code],
      });
    was.current = pending;
  }, [client, code, pending]);
}
