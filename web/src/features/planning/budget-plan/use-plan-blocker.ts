import { useBlocker } from "@tanstack/react-router";
import { useState } from "react";

// A navigation over unsaved changes waits on the reader's answer: asking holds the callback
// that lets it go (false) or keeps the reader on the plan (true).
export function usePlanBlocker(pending: number) {
  const [asking, setAsking] = useState<((block: boolean) => void) | null>(null);
  useBlocker({
    shouldBlockFn: () =>
      pending === 0
        ? false
        : new Promise<boolean>((resolve) => {
            setAsking(() => resolve);
          }),
    enableBeforeUnload: () => pending > 0,
  });

  return {
    asking: asking !== null,
    answer: (block: boolean) => {
      asking?.(block);
      setAsking(null);
    },
  };
}
