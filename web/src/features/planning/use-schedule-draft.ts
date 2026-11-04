import { useState } from "react";

import type { ScheduleDraft } from "@/features/planning/schedule-draft";

// The draft of the schedule form and the one function that changes it.
export function useScheduleDraft(initial: ScheduleDraft) {
  const [draft, setDraft] = useState(initial);

  const patch = (change: Partial<ScheduleDraft>) => {
    setDraft((current) => ({ ...current, ...change }));
  };

  return { draft, patch };
}
